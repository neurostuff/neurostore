import { TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import { ISource } from 'hooks/projects/useGetProjects';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
    useCreateCurationSource,
    useProjectCurationSources,
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

interface ISourceSelectorPopup {
    label?: string;
    sx?: SystemStyleObject;
    onAddSource: (source: ISource) => void;
    onCreateSource?: (source: ISource) => void;
    isLoading?: boolean;
    required?: boolean;
    size?: 'small' | 'medium';
    initialValue?: ISource;
    isError?: boolean;
    helperText?: string;
    excludeSources?: string[];
    disabled?: boolean;
}

const IdentificationSourcePopup: React.FC<ISourceSelectorPopup> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(
        props.initialValue || null
    );
    const [sourceOptions, setSourceOptions] = useState<AutoSelectOption[]>([]);

    const sources = useProjectCurationSources();
    const createNewSource = useCreateCurationSource();

    useEffect(() => {
        if (sources) {
            setSourceOptions((_) => {
                const updatedSources = sources
                    .filter(
                        (originalSource) =>
                            !(props.excludeSources || []).includes(originalSource.id)
                    )
                    .map((source) => ({
                        id: source.id,
                        label: source.label,
                        addOptionActualLabel: null,
                    }));

                return updatedSources;
            });
        }
    }, [sources, props.excludeSources]);

    useEffect(() => {
        setSelectedValue(props.initialValue || null);
    }, [props.initialValue]);

    const handleCreateSource = (sourceName: string) => {
        if (projectId && sources) {
            const newSource: ISource = {
                id: uuidv4(),
                label: sourceName,
            };

            createNewSource(newSource);

            setSelectedValue({
                id: newSource.id,
                label: newSource.label,
                addOptionActualLabel: null,
            });

            if (props.onCreateSource) props.onCreateSource(newSource);
        }
    };

    const handleChange = (
        _event: React.SyntheticEvent<Element, Event>,
        newValue: string | AutoSelectOption | null
    ) => {
        // if user hits enter after typing input, we get a string and handle it here
        if (typeof newValue === 'string') {
            const foundValue = sourceOptions.find(
                (source) => source.label.toLocaleLowerCase() === newValue.toLocaleLowerCase()
            );
            if (foundValue) {
                // do not create a new source if an identical label exists
                setSelectedValue(foundValue);
                props.onAddSource({
                    id: foundValue.id,
                    label: foundValue.label,
                });
            } else {
                handleCreateSource(newValue);
            }
            // if user selects the "Add ..." option, we get an AutoSelectOption and handle it here
        } else if (newValue && newValue.addOptionActualLabel) {
            handleCreateSource(newValue.addOptionActualLabel);
            // if the user clicks an option, we get an AutoSelectOption and handle it here
        } else {
            if (newValue) {
                setSelectedValue(newValue);
                props.onAddSource({
                    id: newValue.id,
                    label: newValue.label,
                });
            }
        }
    };

    return (
        <Autocomplete
            sx={props.sx || { width: '250px' }}
            value={selectedValue || null}
            options={sourceOptions}
            disabled={props.disabled}
            disableClearable={!!selectedValue}
            isOptionEqualToValue={(option, value) => {
                return option?.id === value?.id;
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
                    required={props.required}
                    size={props.size}
                    label={props.label === undefined ? 'select source' : props.label}
                    error={props.isError}
                    helperText={props.helperText}
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

export default IdentificationSourcePopup;
