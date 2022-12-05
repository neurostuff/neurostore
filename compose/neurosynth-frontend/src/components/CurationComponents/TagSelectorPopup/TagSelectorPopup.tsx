import { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { IProvenance, ITag } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

interface AutoSelectOption {
    id: string;
    label: string;
    addOptionActualLabel?: string | null;
}

const filterOptions = createFilterOptions<AutoSelectOption | undefined>({
    ignoreAccents: true,
    ignoreCase: true,
    matchFrom: 'any',
    trim: true,
});

const generateNewTag = (newTag: Omit<ITag, 'id'>, allTags: ITag[]): ITag => {
    const getNewRandId = () => Math.random().toString(16).slice(2);
    const idIsBeingUsed = (givenId: string) => allTags.findIndex((tag) => tag.id === givenId) >= 0;

    // toString(x) turns the number into base x
    let newId = getNewRandId();
    while (idIsBeingUsed(newId)) newId = getNewRandId();

    return {
        ...newTag,
        id: newId,
    };
};

interface ITagSelectorPopup {
    label?: string;
    isExclusion: boolean;
    sx?: SystemStyleObject;
    onAddTag: (tag: ITag) => void;
    onCreateTag?: (tag: ITag) => void;
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
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption>();

    const tags = (data?.provenance?.curationMetadata?.tags || []).filter((x) =>
        props.isExclusion ? x.isExclusionTag : !x.isExclusionTag
    );

    const tagOptions = tags.map((tag) => ({
        id: tag.id || '',
        label: tag.label || '',
        addOptionActualLabel: null,
    }));

    const handleCreateTag = (tagName: string) => {
        const updatedProvenance = { ...data?.provenance };
        if (projectId && updatedProvenance?.curationMetadata?.tags) {
            const prevTags = updatedProvenance?.curationMetadata?.tags || [];

            const generatedTag = generateNewTag(
                { label: tagName, isExclusionTag: props.isExclusion },
                tags
            );

            updatedProvenance.curationMetadata.tags = [generatedTag, ...prevTags];

            mutate(
                {
                    projectId,
                    project: {
                        provenance: updatedProvenance,
                    },
                },
                {
                    onSuccess: () => {
                        if (props.onCreateTag) props.onCreateTag(generatedTag);
                    },
                }
            );
        }
    };

    return (
        <NeurosynthAutocomplete
            isLoading={getProjectIsLoading || updateProjectIsLoading}
            isError={getProjectIsError || updateProjectIsError}
            sx={props.sx || { width: '250px' }}
            value={selectedValue}
            required={false}
            size="small"
            label={props.label || 'select tag'}
            options={tagOptions}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            getOptionLabel={(option) => option?.label || ''}
            onChange={(_event, newValue, _reason) => {
                if (newValue) {
                    if (newValue.addOptionActualLabel) {
                        handleCreateTag(newValue.addOptionActualLabel);
                        setSelectedValue({
                            ...newValue,
                            label: newValue.addOptionActualLabel,
                        });
                        return;
                    }

                    const selectedTag = tags?.find((localTag) => localTag.id === newValue?.id);
                    if (selectedTag) {
                        setSelectedValue(selectedTag);
                        props.onAddTag(selectedTag);
                    }
                }
            }}
            renderOption={(params, option) => (
                <ListItem {...params} key={option?.id}>
                    <ListItemText
                        primary={option?.label || ''}
                        secondary={option?.description || ''}
                    />
                </ListItem>
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
