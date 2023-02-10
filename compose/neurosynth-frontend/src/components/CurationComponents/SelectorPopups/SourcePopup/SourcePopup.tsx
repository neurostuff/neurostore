import { Box, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { ISource } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ErrorIcon from '@mui/icons-material/Error';

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
}

const IdentificationSourcePopup: React.FC<ISourceSelectorPopup> = (props) => {
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
    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(
        props.initialValue || null
    );

    useEffect(() => {
        setSelectedValue(props.initialValue || null);
    }, [props.initialValue]);

    const sources = data?.provenance?.curationMetadata?.identificationSources || [];

    const sourceOptions: AutoSelectOption[] = sources.map((source) => ({
        id: source.id,
        label: source.label,
        addOptionActualLabel: null,
    }));

    const handleCreateSource = (sourceName: string) => {
        if (projectId && data?.provenance?.curationMetadata?.identificationSources) {
            const prevSources = data.provenance.curationMetadata.identificationSources;
            const newSource = { id: uuidv4(), label: sourceName };
            const updatedSources = [newSource, ...prevSources];

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                identificationSources: updatedSources,
                            },
                        },
                    },
                },
                {
                    onSuccess: () => {
                        if (props.onCreateSource) {
                            props.onCreateSource(newSource);
                            setSelectedValue({
                                id: newSource.id,
                                label: newSource.label,
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

    const isLoading = getProjectIsLoading || updateProjectIsLoading || props.isLoading;
    const isError = getProjectIsError || updateProjectIsError;

    return (
        <Autocomplete
            sx={props.sx || { width: '250px' }}
            value={selectedValue || null}
            options={sourceOptions}
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
                    label={props.label || 'select source'}
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
