import { TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import { ITag } from 'hooks/requests/useGetProjects';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import {
    useCreateNewCurationInfoTag,
    useProjectCurationInfoTags,
} from 'pages/Projects/ProjectPage/ProjectStore';

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
    sx?: SystemStyleObject;
    onAddTag: (tag: ITag) => void;
    onCreateTag?: (tag: ITag) => void;
    isLoading?: boolean;
    size?: 'small' | 'medium';
}

const TagSelectorPopup: React.FC<ITagSelectorPopup> = (props) => {
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [tagOption, setTagOptions] = useState<AutoSelectOption[]>([]);

    const infoTags = useProjectCurationInfoTags();
    const createNewInfoTag = useCreateNewCurationInfoTag();

    useEffect(() => {
        const filteredTagOptions = infoTags
            .filter(
                (x) =>
                    x.id !== ENeurosynthTagIds.UNTAGGED_TAG_ID &&
                    x.id !== ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID &&
                    x.id !== ENeurosynthTagIds.UNCATEGORIZED_ID
            )
            .map((tag) => ({
                id: tag.id,
                label: tag.label,
                addOptionActualLabel: null,
            }));

        setTagOptions(filteredTagOptions);
    }, [infoTags]);

    const handleCreateTag = (tagName: string) => {
        const newTag: ITag = {
            id: uuidv4(),
            label: tagName,
            isExclusionTag: false,
            isAssignable: true,
        };

        createNewInfoTag(newTag);
        setSelectedValue({
            id: newTag.id,
            label: newTag.label,
            addOptionActualLabel: null,
        });
        if (props.onCreateTag) props.onCreateTag(newTag);
    };

    const handleChange = (
        _event: React.SyntheticEvent<Element, Event>,
        newValue: string | AutoSelectOption | null
    ) => {
        // if user hits enter after typing input, we get a string and handle it here
        if (typeof newValue === 'string') {
            const foundValue = tagOption.find(
                (tag) => tag.label.toLocaleLowerCase() === newValue.toLocaleLowerCase()
            );
            if (foundValue) {
                // do not create a new tag if an identical label exists
                setSelectedValue(foundValue);
                props.onAddTag({
                    id: foundValue.id,
                    label: foundValue.label,
                    isExclusionTag: false,
                    isAssignable: true,
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
                    isExclusionTag: false,
                    isAssignable: true,
                });
        }
    };

    // const isLoading = getProjectIsLoading || updateProjectIsLoading || props.isLoading;
    // const isError = getProjectIsError || updateProjectIsError;

    return (
        <Autocomplete
            sx={props.sx || { width: '250px' }}
            value={selectedValue || null}
            options={tagOption}
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
                    size={props.size}
                    placeholder="start typing to create a tag"
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
