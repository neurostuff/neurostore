import { TextField, TextFieldProps } from '@mui/material';
import { ChangeEvent, useEffect, useState } from 'react';

type EDebouncedTextFieldProps = Omit<TextFieldProps, 'onChange' | 'value'> & {
    onChange?: (value: string | undefined) => void;
    value?: string | undefined;
};

const DebouncedTextField: React.FC<EDebouncedTextFieldProps> = ({
    value,
    onChange,
    ...otherProps
}) => {
    const [debouncedValue, setDebouncedValue] = useState(value || '');

    useEffect(() => {
        const debounce = setTimeout(() => {
            onChange && onChange(debouncedValue);
        }, 500);
        return () => {
            clearTimeout(debounce);
        };
    }, [debouncedValue, onChange]);

    const handleOnChange = (event: ChangeEvent<HTMLInputElement>) => {
        setDebouncedValue(event.target.value);
    };

    return <TextField {...otherProps} onChange={handleOnChange} value={debouncedValue || ''} />;
};

export default DebouncedTextField;
