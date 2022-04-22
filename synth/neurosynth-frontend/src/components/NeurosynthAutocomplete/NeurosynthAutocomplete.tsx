import { Autocomplete, TextField, AutocompleteRenderOptionState } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
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
    renderOption: (
        props: React.HTMLAttributes<HTMLLIElement>,
        option: any,
        state?: AutocompleteRenderOptionState
    ) => React.ReactNode;
    value: T;
    getOptionLabel: (option: T) => string;
    onChange: (_event: any, newVal: T | null, _reason: any) => void;
    options: T[];
    sx?: SystemStyleObject;
}

const NeurosynthAutocomplete = <X,>(props: INeurosynthAutocomplete<X>) => {
    const { handleChange, handleOnBlur, handleOnFocus, isValid } = useInputValidation(
        props.value,
        (arg: X | undefined | null) => !!arg
    );
    const {
        required = true,
        label,
        shouldDisable = false,
        renderOption,
        value,
        getOptionLabel,
        onChange,
        options,
        isOptionEqualToValue,
        sx = {},
    } = props;

    const handleOnChange = (_event: any, newVal: X | null, _reason: any) => {
        handleChange(newVal);
        onChange(_event, newVal, _reason);
    };

    return (
        <Autocomplete
            onFocus={handleOnFocus}
            onBlur={handleOnBlur}
            disabled={shouldDisable}
            isOptionEqualToValue={isOptionEqualToValue}
            renderOption={renderOption}
            sx={sx}
            renderInput={(params) => (
                <TextField
                    helperText={isValid || !required ? null : 'this is requird'}
                    error={!isValid && required}
                    {...params}
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
