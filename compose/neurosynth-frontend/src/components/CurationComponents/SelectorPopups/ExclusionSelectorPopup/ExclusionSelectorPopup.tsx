import { Box, Button, ButtonGroup, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { indexToPRISMAMapping, INeurosynthProject, ITag } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ErrorIcon from '@mui/icons-material/Error';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useQueryClient } from 'react-query';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

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
    const { projectId }: { projectId: string | undefined } = useParams();
    const excludeButtonRef = useRef<any>(null);
    const queryClient = useQueryClient();
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        mutate,
        isLoading: updateProjectIsLoading,
        isError: updateProjectIsError,
    } = useUpdateProject();
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [exclusions, setExclusions] = useState<AutoSelectOption[]>([]);
    const [defaultExclusion, setDefaultExclusion] = useState<AutoSelectOption>();

    useEffect(() => {
        if (data?.provenance?.curationMetadata?.prismaConfig) {
            if (data.provenance.curationMetadata.prismaConfig.isPrisma) {
                const phase = indexToPRISMAMapping(props.columnIndex);
                const filteredExclusions = phase
                    ? data.provenance.curationMetadata.prismaConfig[phase].exclusionTags
                    : [];

                const exclusionOptions: AutoSelectOption[] = filteredExclusions.map(
                    (exclusion) => ({
                        id: exclusion.id,
                        label: exclusion.label,
                        addOptionActualLabel: null,
                    })
                );
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
                setExclusions(data.provenance.curationMetadata.exclusionTags);
            }
        }
    }, [
        data?.provenance?.curationMetadata?.prismaConfig,
        data?.provenance?.curationMetadata?.exclusionTags,
        props.columnIndex,
    ]);

    const handleCreateExclusion = (exclusionName: string) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.prismaConfig &&
            data?.provenance?.curationMetadata?.exclusionTags
        ) {
            let project: INeurosynthProject;
            let newExclusion: ITag;
            const phase = indexToPRISMAMapping(props.columnIndex);
            if (data.provenance.curationMetadata.prismaConfig.isPrisma && phase) {
                const prevExclusions = phase
                    ? data.provenance.curationMetadata.prismaConfig[phase].exclusionTags
                    : [];
                newExclusion = {
                    id: uuidv4(),
                    label: exclusionName,
                    isExclusionTag: true,
                    isAssignable: true,
                };
                const updatedExclusions = [newExclusion, ...prevExclusions];

                project = {
                    provenance: {
                        ...data.provenance,
                        curationMetadata: {
                            ...data.provenance.curationMetadata,
                            prismaConfig: {
                                ...data.provenance.curationMetadata.prismaConfig,
                                [phase]: {
                                    ...data.provenance.curationMetadata.prismaConfig[phase],
                                    exclusionTags: updatedExclusions,
                                },
                            },
                        },
                    },
                };
            } else {
                const prevExclusions = data.provenance.curationMetadata.exclusionTags;
                newExclusion = {
                    id: uuidv4(),
                    label: exclusionName,
                    isExclusionTag: true,
                    isAssignable: true,
                };
                const updatedExclusions = [newExclusion, ...prevExclusions];

                project = {
                    provenance: {
                        ...data.provenance,
                        curationMetadata: {
                            ...data.provenance.curationMetadata,
                            exclusionTags: updatedExclusions,
                        },
                    },
                };
            }

            mutate(
                {
                    projectId,
                    project: project,
                },
                {
                    onSuccess: (res) => {
                        if (res && res.status >= 200 && res.status < 300) {
                            queryClient.setQueryData(['projects', res.data.id], res);
                            if (props.onCreateExclusion) {
                                props.onCreateExclusion(newExclusion);
                                setSelectedValue({
                                    id: newExclusion.id,
                                    label: newExclusion.label,
                                    addOptionActualLabel: null,
                                });
                            }
                        }
                    },
                }
            );
        }
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

    const isLoading = getProjectIsLoading || updateProjectIsLoading || props.isLoading;
    const isError = getProjectIsError || updateProjectIsError;

    return (
        <>
            <NeurosynthPopper
                open={props.popupIsOpen}
                anchorElement={excludeButtonRef?.current}
                placement="bottom-start"
                onClickAway={() => props.onClosePopup()}
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
                                error={isError}
                                placeholder="start typing to create exclusion"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {isError && (
                                                <Box sx={{ color: 'error.main', display: 'flex' }}>
                                                    There was an error
                                                    <ErrorIcon sx={{ marginLeft: '5px' }} />
                                                </Box>
                                            )}
                                            {isLoading && <ProgressLoader size={20} />}
                                            {!isError &&
                                                !isLoading &&
                                                params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
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
                    onClick={() => props.onOpenPopup()}
                >
                    {defaultExclusion ? <ArrowDropDownIcon /> : 'exclude'}
                </Button>
            </ButtonGroup>
        </>
    );
};

export default ExclusionSelectorPopup;
