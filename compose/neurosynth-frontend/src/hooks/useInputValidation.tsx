import { useEffect, useState } from 'react';

const useInputValidation = <T,>(
    inputValue: T | undefined | null,
    validationFn: (arg: T | undefined | null) => boolean
) => {
    const [touched, setTouched] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isValid, setIsValid] = useState(true);

    const [value, setValue] = useState<T | null | undefined>(inputValue);

    useEffect(() => {
        const hasValue = value !== undefined && value !== null;
        if (touched && (hasValue || !isFocused)) {
            // we validate if value exists or if we focus out
            const isValidValue = validationFn(value);
            setIsValid(isValidValue);
        }
    }, [value, isFocused, touched, validationFn]);

    useEffect(() => {
        setValue(inputValue);
    }, [inputValue]);

    const handleChange = (change: T | null | undefined) => {
        setTouched(true);
        setValue(change);
    };

    const handleOnFocus = (arg: any) => {
        setTouched(true);
        setIsFocused(true);
    };

    const handleOnBlur = (arg: any) => {
        setIsFocused(false);
    };

    return {
        handleOnFocus,
        handleChange,
        handleOnBlur,
        isValid,
    };
};

export default useInputValidation;
