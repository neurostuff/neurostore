import { Box, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { ITag } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ErrorIcon from '@mui/icons-material/Error';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';

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

interface ITagSelectorPopup {
    label?: string;
    isExclusion: boolean;
    sx?: SystemStyleObject;
    onAddTag: (tag: ITag) => void;
    onCreateTag?: (tag: ITag) => void;
    isLoading?: boolean;
}

const TagSelectorPopup: React.FC<ITagSelectorPopup> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
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

    const tags = (data?.provenance?.curationMetadata?.tags || []).filter((x) =>
        props.isExclusion
            ? x.isExclusionTag
            : !x.isExclusionTag &&
              x.id !== ENeurosynthTagIds.UNTAGGED_TAG_ID &&
              x.id !== ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID &&
              x.id !== ENeurosynthTagIds.NON_EXCLUDED_ID
    );

    const tagOptions: AutoSelectOption[] = tags.map((tag) => ({
        id: tag.id,
        label: tag.label,
        addOptionActualLabel: null,
    }));

    const handleCreateTag = (tagName: string) => {
        if (projectId && data?.provenance?.curationMetadata?.tags) {
            const prevTags = data.provenance.curationMetadata.tags;
            const newTag = { id: uuidv4(), label: tagName, isExclusionTag: props.isExclusion };
            const updatedTags = [newTag, ...prevTags];

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                tags: updatedTags,
                            },
                        },
                    },
                },
                {
                    onSuccess: () => {
                        if (props.onCreateTag) {
                            props.onCreateTag(newTag);
                            setSelectedValue({
                                id: newTag.id,
                                label: newTag.label,
                                addOptionActualLabel: null,
                            });
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
            const foundValue = tagOptions.find(
                (tag) => tag.label.toLocaleLowerCase() === newValue.toLocaleLowerCase()
            );
            if (foundValue) {
                // do not create a new tag if an identical label exists
                setSelectedValue(foundValue);
                props.onAddTag({
                    id: foundValue.id,
                    label: foundValue.label,
                    isExclusionTag: props.isExclusion,
                });
            } else {
                handleCreateTag(newValue);
            }
            // if user selects the "Add ..." option, we get an AutoSelectOption and handle it here
        } else if (newValue && newValue.addOptionActualLabel) {
            handleCreateTag(newValue.addOptionActualLabel);
            // if the user clicks an option, we get an AutoSelectOption and handle it here
        } else {
            setSelectedValue(newValue);
            if (newValue)
                props.onAddTag({
                    id: newValue.id,
                    label: newValue.label,
                    isExclusionTag: props.isExclusion,
                });
        }
    };

    const isLoading = getProjectIsLoading || updateProjectIsLoading || props.isLoading;
    const isError = getProjectIsError || updateProjectIsError;

    return (
        <Autocomplete
            sx={props.sx || { width: '250px' }}
            value={selectedValue || null}
            options={tagOptions}
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

export default TagSelectorPopup;
