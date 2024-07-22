import ErrorIcon from '@mui/icons-material/Error';
import {
    Autocomplete,
    AutocompleteRenderOptionState,
    Box,
    FilterOptionsState,
    TextField,
} from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader';
import { useInputValidation } from '../../hooks';

export interface IAutocompleteObject {
    label: string;
    description: string;
}

interface INeurosynthAutocomplete<T> {
    required?: boolean;
    label: string;
    shouldDisable?: boolean;
    isOptionEqualToValue: (option: T, value: T) => boolean;
    renderOption?: (
        props: React.HTMLAttributes<HTMLLIElement>,
        option: any,
        state?: AutocompleteRenderOptionState
    ) => React.ReactNode;
    value: T;
    freeSolo?: boolean;
    getOptionLabel: (option: T) => string;
    onChange: (_event: any, newVal: T | null, _reason: any) => void;
    options: T[];
    sx?: SystemStyleObject;
    isLoading?: boolean;
    isError?: boolean;
    noOptionsText?: string;
    size?: 'small' | 'medium';
    inputPropsSx?: SystemStyleObject;
    filterOptions?: (options: T[], state: FilterOptionsState<T>) => T[];
    groupBy?: (option: T) => string;
}

const NeurosynthAutocomplete = <T,>(props: INeurosynthAutocomplete<T>) => {
    const { handleOnBlur, handleOnFocus, isValid } = useInputValidation(
        props.value,
        (arg: T | undefined | null) => !!arg
    );
    const {
        required = true,
        label,
        shouldDisable = false,
        renderOption = undefined,
        value,
        getOptionLabel,
        onChange,
        options,
        isOptionEqualToValue,
        sx = {},
        isLoading = false,
        isError = false,
        filterOptions = undefined,
        noOptionsText = undefined,
        size = 'small',
        inputPropsSx = {},
        groupBy = undefined,
    } = props;

    const handleOnChange = (_event: any, newVal: T | null, _reason: any) => {
        // handleChange(newVal);
        onChange(_event, newVal, _reason);
    };

    return (
        <Autocomplete
            noOptionsText={noOptionsText}
            loading={isLoading}
            loadingText="Loading..."
            onFocus={handleOnFocus}
            onBlur={handleOnBlur}
            groupBy={groupBy}
            size={size}
            disabled={shouldDisable}
            isOptionEqualToValue={isOptionEqualToValue}
            renderOption={renderOption}
            sx={sx}
            filterOptions={filterOptions}
            renderInput={(params) => (
                <TextField
                    {...params}
                    helperText={isValid || !required ? null : 'this is required'}
                    error={!isValid && required}
                    InputProps={{
                        ...params.InputProps,
                        sx: inputPropsSx,
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
                    label={label}
                />
            )}
            value={value || null}
            getOptionLabel={getOptionLabel}
            onChange={handleOnChange}
            options={options}
        />
    );
};

export default NeurosynthAutocomplete;
