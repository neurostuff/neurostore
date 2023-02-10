import { Box, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { indexToPRISMAMapping, INeurosynthProject, ITag } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ErrorIcon from '@mui/icons-material/Error';
import { useQueryClient } from 'react-query';

interface IExclusionSelectorPopup {
    label?: string;
    sx?: SystemStyleObject;
    onAddExclusion: (tag: ITag) => void;
    onCreateExclusion?: (tag: ITag) => void;
    isLoading?: boolean;
    size?: 'small' | 'medium';
    columnIndex: number;
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

    const isLoading = getProjectIsLoading || updateProjectIsLoading || props.isLoading;
    const isError = getProjectIsError || updateProjectIsError;

    return (
        <Autocomplete
            sx={props.sx || { width: '250px' }}
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
                <ListItem {...params} key={option?.id}>
                    <ListItemText primary={option?.label || ''} />
                </ListItem>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    error={isError}
                    size={props.size}
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
                                {!isError && !isLoading && params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                    label={props.label || 'select tag'}
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
    );
};

export default ExclusionSelectorPopup;
