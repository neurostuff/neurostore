import { TextField, TextFieldProps } from '@mui/material';
import { ChangeEvent, useEffect, useState } from 'react';

type EDebouncedTextFieldProps = Omit<TextFieldProps, 'onChange' | 'value'> & {
    onChange?: (value: string | undefined) => void;
    value?: string | undefined;
};

const DebouncedTextField: React.FC<EDebouncedTextFieldProps> = ({ value, onChange, ...otherProps }) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        if (debouncedValue === value) return;
        const debounce = setTimeout(() => {
            if (onChange) {
                onChange(debouncedValue);
            }
        }, 400);
        return () => {
            clearTimeout(debounce);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedValue, onChange]);

    // when an update occurs from outside the component, we want to reflect that new value (like if a filter is cleard)
    useEffect(() => {
        setDebouncedValue(value);
    }, [value]);

    const handleOnChange = (event: ChangeEvent<HTMLInputElement>) => {
        setDebouncedValue(event.target.value);
    };

    return <TextField {...otherProps} onChange={handleOnChange} value={debouncedValue || ''} />;
};

export default DebouncedTextField;
