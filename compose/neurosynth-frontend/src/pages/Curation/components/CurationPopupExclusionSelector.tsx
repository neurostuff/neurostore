import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Box, Button, ButtonGroup, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import LoadingButton from 'components/Buttons/LoadingButton';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { ITag } from 'hooks/projects/useGetProjects';
import { useProjectCurationExclusionTags, useProjectCurationPrismaConfig } from 'pages/Project/store/ProjectStore';
import { defaultExclusionTags, ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.consts';
import { useEffect, useRef, useState } from 'react';

interface IExclusionSelectorPopup {
    onAddExclusion: (tag: ITag) => void;
    onCreateExclusion?: (tagName: string) => void;
    onClosePopup: () => void;
    onOpenPopup: () => void;
    isLoading?: boolean;
    prismaPhase?: 'identification' | 'screening' | 'eligibility';
    disabled?: boolean;
    popupIsOpen: boolean;
    exclusionButtonEndText?: string;
    onlyShowDefaultExclusion?: boolean;
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

const CurationPopupExclusionSelector: React.FC<IExclusionSelectorPopup> = (props) => {
    const excludeButtonRef = useRef<HTMLDivElement>(null);
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [exclusions, setExclusions] = useState<AutoSelectOption[]>([]);
    const [defaultExclusion, setDefaultExclusion] = useState<AutoSelectOption>(defaultExclusionTags.exclusion);

    const prismaConfig = useProjectCurationPrismaConfig();
    const genericExclusionTags = useProjectCurationExclusionTags();

    useEffect(() => {
        if (!props.popupIsOpen) setSelectedValue(null);
    }, [props.popupIsOpen]);

    useEffect(() => {
        if (prismaConfig.isPrisma) {
            const filteredExclusions = props.prismaPhase ? prismaConfig[props.prismaPhase].exclusionTags : [];

            const exclusionOptions: AutoSelectOption[] = filteredExclusions.map((exclusion) => ({
                id: exclusion.id,
                label: exclusion.label,
                addOptionActualLabel: null,
            }));
            setExclusions(exclusionOptions);

            // identification and screening phases only have a single exclusion
            if (props.prismaPhase === 'identification') {
                setDefaultExclusion({
                    id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                    label: 'Duplicate',
                    addOptionActualLabel: null,
                });
            } else if (props.prismaPhase === 'screening') {
                setDefaultExclusion({
                    id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
                    label: 'Irrelevant',
                    addOptionActualLabel: null,
                });
            } else if (props.prismaPhase === 'eligibility') {
                setDefaultExclusion({
                    id: ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID,
                    label: 'Out of scope',
                    addOptionActualLabel: null,
                });
            }
        } else {
            setDefaultExclusion(defaultExclusionTags.exclusion);
            setExclusions(genericExclusionTags);
        }
    }, [prismaConfig, genericExclusionTags, props.prismaPhase]);

    const handleChange = (_event: React.SyntheticEvent<Element, Event>, newValue: string | AutoSelectOption | null) => {
        // if user hits enter after typing input, we get a string and handle it here
        if (typeof newValue === 'string') {
            const foundValue = exclusions.find((tag) => tag.label.toLocaleLowerCase() === newValue.toLocaleLowerCase());
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
                if (props.onCreateExclusion) props.onCreateExclusion(newValue);
            }
            // if user selects the "Add ..." option, we get an AutoSelectOption and handle it here
        } else if (newValue && newValue.addOptionActualLabel) {
            if (props.onCreateExclusion) props.onCreateExclusion(newValue.addOptionActualLabel);
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
                <Box sx={{ marginTop: '7px' }}>
                    <Autocomplete
                        size="small"
                        sx={{ width: excludeButtonRef.current?.clientWidth }}
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
                        getOptionLabel={(option) => (typeof option === 'string' ? option : option?.label || '')}
                        onChange={handleChange}
                        renderOption={(params, option) => (
                            <ListItem {...params} key={option?.id} sx={{ fontSize: '12px !important' }}>
                                <ListItemText
                                    primary={option?.label || ''}
                                    primaryTypographyProps={{ fontSize: '12px', color: 'error.dark' }}
                                />
                            </ListItem>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                InputLabelProps={{
                                    ...params.InputLabelProps,
                                    style: { ...params.InputLabelProps.style, fontSize: '12px' },
                                }}
                                InputProps={{
                                    ...params.InputProps,
                                    style: { ...(params.InputProps as any).style, fontSize: '12px' },
                                }}
                                size="small"
                                placeholder="type to create new"
                                label="reason to exclude"
                            />
                        )}
                        filterOptions={(options, params) => {
                            const filteredValues = filterOptions(options, params);

                            const optionExists = options.some(
                                (option) =>
                                    params.inputValue.toLocaleLowerCase() === (option?.label || '').toLocaleLowerCase()
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
            <div ref={excludeButtonRef}>
                <ButtonGroup size="small" disabled={!!props.disabled} color="error">
                    <LoadingButton
                        startIcon={<HighlightOffIcon />}
                        text={defaultExclusion.label + (props.exclusionButtonEndText || '')}
                        sx={{
                            fontSize: '12px',
                            minWidth: props.onlyShowDefaultExclusion ? '140px !important' : undefined,
                        }}
                        isLoading={props.isLoading && !props.popupIsOpen}
                        onClick={() => handleSelectDefaultExclusion(defaultExclusion)}
                    />
                    {!props.onlyShowDefaultExclusion && (
                        <Button
                            startIcon={defaultExclusion ? undefined : <HighlightOffIcon />}
                            sx={{ width: '32px' }}
                            onClick={() => props.onOpenPopup()}
                        >
                            <ArrowDropDownIcon sx={{ fontSize: '22px' }} />
                        </Button>
                    )}
                </ButtonGroup>
            </div>
        </>
    );
};

export default CurationPopupExclusionSelector;
