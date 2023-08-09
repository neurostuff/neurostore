import { TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCreateNewCurationImport, useProjectCurationImports } from 'stores/ProjectStore';
import { IImport } from 'interfaces/project/curation.interface';

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

interface IImportSelectorPopup {
    label?: string;
    sx?: SystemStyleObject;
    onSelectImport: (anImport: Partial<IImport>) => void;
    onCreateImport?: (anImport: Partial<IImport>) => void;
    isLoading?: boolean;
    size?: 'small' | 'medium';
    placeholder?: string;
    addOptionText?: string;
    onClearInput?: () => void;
}

const ImportSelectorPopup: React.FC<IImportSelectorPopup> = (props) => {
    const {
        placeholder = 'start typing',
        addOptionText = 'Add',
        label = 'select import',
        onClearInput = () => {},
    } = props;

    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [tagOption, setTagOptions] = useState<AutoSelectOption[]>([]);

    const imports = useProjectCurationImports();
    const createImport = useCreateNewCurationImport();

    useEffect(() => {
        const filteredTagOptions = imports.map((anImport) => ({
            id: anImport.id,
            label: anImport.name,
            addOptionActualLabel: null,
        }));

        setTagOptions(filteredTagOptions);
    }, [imports]);

    const handleCreateImport = (importName: string) => {
        const newImport: Partial<IImport> = {
            id: uuidv4(),
            name: importName,
        };

        setSelectedValue({
            id: newImport.id as string,
            label: newImport.name as string,
            addOptionActualLabel: null,
        });
        if (props.onCreateImport) props.onCreateImport(newImport);
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
                props.onSelectImport({
                    id: foundValue.id,
                    name: foundValue.label,
                });
            } else {
                handleCreateImport(newValue);
            }
            // if user selects the "Add ..." option, we get an AutoSelectOption and handle it here
        } else if (newValue && newValue.addOptionActualLabel) {
            handleCreateImport(newValue.addOptionActualLabel);
            // if the user clicks an option, we get an AutoSelectOption and handle it here
        } else {
            setSelectedValue(newValue);
            if (newValue) {
                props.onSelectImport({
                    id: newValue.id,
                    name: newValue.label,
                });
            } else {
                onClearInput();
            }
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
                    placeholder={placeholder}
                    label={label || 'select tag'}
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
                        label: `${addOptionText} "${params.inputValue}"`,
                        addOptionActualLabel: params.inputValue,
                    });
                }
                return filteredValues;
            }}
        />
    );
};

export default ImportSelectorPopup;
