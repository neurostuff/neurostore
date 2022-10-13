import { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useState } from 'react';

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

const AddTagSelectorPopup: React.FC<{
    tags: { label: string; id: string }[];
    onCreateTag: (tagName: string) => void;
    onAddTag: (tag: { label: string; id: string }) => void;
}> = (props) => {
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption>();

    const tagOptions: AutoSelectOption[] = (props.tags || []).map((tag) => ({
        id: tag.id || '',
        label: tag.label || '',
        addOptionActualLabel: null,
    }));

    return (
        <>
            <NeurosynthAutocomplete
                sx={{ width: '250px' }}
                value={selectedValue}
                required={false}
                label="select tag"
                options={tagOptions}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                getOptionLabel={(option) => option?.label || ''}
                onChange={(_event, newValue, _reason) => {
                    if (newValue) {
                        if (newValue.addOptionActualLabel) {
                            props.onCreateTag(newValue.addOptionActualLabel);
                            return;
                        }

                        const selectedTag = (props.tags || [])?.find(
                            (localTag) => localTag.id === newValue?.id
                        );
                        if (selectedTag) {
                            setSelectedValue(newValue);
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
        </>
    );
};

export default AddTagSelectorPopup;
