import { Box, Button, ButtonGroup, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { indexToPRISMAMapping, ITag } from 'hooks/projects/useGetProjects';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import {
    useCreateNewExclusion,
    useProjectCurationExclusionTags,
    useProjectCurationPrismaConfig,
} from 'pages/Projects/ProjectPage/ProjectStore';

interface IExclusionSelectorPopup {
    onAddExclusion: (tag: ITag) => void;
    onCreateExclusion?: (tag: ITag) => void;
    onClosePopup: () => void;
    onOpenPopup: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    columnIndex: number;
    popupIsOpen: boolean;
}

interface AutoSelectOption {
    id: string;
    label: string;
    addOptionActualLabel?: string | null;
}

const filterOptions = createFilterOptions<AutoSelectOption>({
    ignoreAccents: true,
    ignoreCase: true,
    matchFrom: 'any',
    trim: true,
});

const ExclusionSelectorPopup: React.FC<IExclusionSelectorPopup> = (props) => {
    const excludeButtonRef = useRef<any>(null);
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [exclusions, setExclusions] = useState<AutoSelectOption[]>([]);
    const [defaultExclusion, setDefaultExclusion] = useState<AutoSelectOption>();

    const prismaConfig = useProjectCurationPrismaConfig();
    const genericExclusionTags = useProjectCurationExclusionTags();
    const createExclusion = useCreateNewExclusion();

    useEffect(() => {
        if (!props.popupIsOpen) setSelectedValue(null);
    }, [props.popupIsOpen]);

    useEffect(() => {
        if (prismaConfig.isPrisma) {
            const phase = indexToPRISMAMapping(props.columnIndex);
            const filteredExclusions = phase ? prismaConfig[phase].exclusionTags : [];

            const exclusionOptions: AutoSelectOption[] = filteredExclusions.map((exclusion) => ({
                id: exclusion.id,
                label: exclusion.label,
                addOptionActualLabel: null,
            }));
            setExclusions(exclusionOptions);

            // identification and screening phases only have a single exclusion
            if (phase === 'identification') {
                setDefaultExclusion({
                    id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                    label: 'Duplicate',
                    addOptionActualLabel: null,
                });
            } else if (phase === 'screening') {
                setDefaultExclusion({
                    id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
                    label: 'Irrelevant',
                    addOptionActualLabel: null,
                });
            }
        } else {
            setExclusions(genericExclusionTags);
        }
    }, [prismaConfig, genericExclusionTags, props.columnIndex]);

    const handleCreateExclusion = (exclusionName: string) => {
        const phase = prismaConfig.isPrisma ? indexToPRISMAMapping(props.columnIndex) : undefined;
        const newExclusion = {
            id: uuidv4(),
            label: exclusionName,
            isExclusionTag: true,
            isAssignable: true,
        };

        createExclusion(newExclusion, phase);

        if (props.onCreateExclusion) props.onCreateExclusion(newExclusion);
    };

    const handleChange = (
        _event: React.SyntheticEvent<Element, Event>,
        newValue: string | AutoSelectOption | null
    ) => {
        // if user hits enter after typing input, we get a string and handle it here
        if (typeof newValue === 'string') {
            const foundValue = exclusions.find(
                (tag) => tag.label.toLocaleLowerCase() === newValue.toLocaleLowerCase()
            );
            if (foundValue) {
                // do not create a new tag if an identical label exists
                setSelectedValue(foundValue);
                props.onAddExclusion({
                    id: foundValue.id,
                    label: foundValue.label,
                    isExclusionTag: true,
                    isAssignable: true,
                });
            } else {
                handleCreateExclusion(newValue);
            }
            // if user selects the "Add ..." option, we get an AutoSelectOption and handle it here
        } else if (newValue && newValue.addOptionActualLabel) {
            handleCreateExclusion(newValue.addOptionActualLabel);
            // if the user clicks an option, we get an AutoSelectOption and handle it here
        } else {
            setSelectedValue(newValue);
            if (newValue)
                props.onAddExclusion({
                    id: newValue.id,
                    label: newValue.label,
                    isExclusionTag: true,
                    isAssignable: true,
                });
        }
    };

    const handleSelectDefaultExclusion = (option?: AutoSelectOption) => {
        if (!option) return;

        props.onAddExclusion({
            id: option.id,
            label: option.label,
            isExclusionTag: true,
            isAssignable: true,
        });
    };

    const handleClosePopup = () => {
        setSelectedValue(null);
        props.onClosePopup();
    };

    return (
        <>
            <NeurosynthPopper
                open={props.popupIsOpen}
                anchorElement={excludeButtonRef?.current}
                placement="bottom-start"
                onClickAway={handleClosePopup}
            >
                <Box sx={{ marginTop: '6px' }}>
                    <Autocomplete
                        sx={{ width: '250px' }}
                        value={selectedValue || null}
                        options={exclusions}
                        freeSolo
                        isOptionEqualToValue={(option, value) => {
                            if (value.addOptionActualLabel === null) {
                                return false;
                            } else {
                                return option?.id === value?.id;
                            }
                        }}
                        getOptionLabel={(option) =>
                            typeof option === 'string' ? option : option?.label || ''
                        }
                        onChange={handleChange}
                        renderOption={(params, option) => (
                            <ListItem {...params} key={option?.id}>
                                <ListItemText primary={option?.label || ''} />
                            </ListItem>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="start typing to create exclusion"
                                label="select exclusion reason"
                            />
                        )}
                        filterOptions={(options, params) => {
                            const filteredValues = filterOptions(options, params);

                            const optionExists = options.some(
                                (option) =>
                                    params.inputValue.toLocaleLowerCase() ===
                                    (option?.label || '').toLocaleLowerCase()
                            );

                            if (params.inputValue !== '' && !optionExists) {
                                filteredValues.push({
                                    id: '',
                                    label: `Add "${params.inputValue}"`,
                                    addOptionActualLabel: params.inputValue,
                                });
                            }
                            return filteredValues;
                        }}
                    />
                </Box>
            </NeurosynthPopper>
            <ButtonGroup disabled={!!props.disabled} color="error" ref={excludeButtonRef}>
                {defaultExclusion && (
                    <LoadingButton
                        variant="outlined"
                        startIcon={<HighlightOffIcon />}
                        sx={{ width: '210px' }}
                        text={`Exclude: ${defaultExclusion?.label}`}
                        isLoading={props.isLoading && !props.popupIsOpen}
                        onClick={() => handleSelectDefaultExclusion(defaultExclusion)}
                    />
                )}
                <Button
                    startIcon={defaultExclusion ? undefined : <HighlightOffIcon />}
                    size="small"
                    sx={{ width: defaultExclusion ? '44px' : '160px' }}
                    onClick={() => props.onOpenPopup()}
                >
                    {defaultExclusion ? <ArrowDropDownIcon /> : 'exclude'}
                </Button>
            </ButtonGroup>
        </>
    );
};

export default ExclusionSelectorPopup;
