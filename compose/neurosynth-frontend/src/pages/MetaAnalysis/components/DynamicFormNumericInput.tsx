import { Box, TextField } from '@mui/material';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';
import DynamicFormStyles from 'pages/MetaAnalysis/components//DynamicFormStyles';
import { useEffect, useState } from 'react';

// Matches a number being typed in-progress: '', '0', '0.', '0.001', '-0.5'
const NUMERIC_IN_PROGRESS = /^-?\d*\.?\d*$/;

const toRaw = (value: any): string => (value === null || value === undefined ? '' : String(value));

const DynamicFormNumericInput: React.FC<IDynamicFormInput> = (props) => {
    const [rawValue, setRawValue] = useState<string>(toRaw(props.value));

    // Sync external value changes, but don't clobber an in-progress entry like "0."
    // (which parses to the same number we already emitted).
    useEffect(() => {
        const parsed = rawValue === '' ? null : parseFloat(rawValue);
        if (props.value !== parsed) {
            setRawValue(toRaw(props.value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        if (text !== '' && !NUMERIC_IN_PROGRESS.test(text)) return;
        setRawValue(text);
        if (text === '') {
            props.onUpdate({ [props.parameterName]: null });
            return;
        }
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) {
            props.onUpdate({ [props.parameterName]: parsed });
        }
    };

    return (
        <Box sx={DynamicFormStyles.input}>
            <MetaAnalysisDynamicFormTitle
                disabled={props.disabled}
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Box sx={{ width: '50%' }}>
                <TextField
                    disabled={props.disabled}
                    name={props.parameterName}
                    onChange={handleChange}
                    value={rawValue}
                    label="number"
                    sx={{ width: '100%', opacity: props.disabled ? 0.4 : 1 }}
                    type="text"
                    inputProps={{ inputMode: 'decimal' }}
                />
            </Box>
        </Box>
    );
};

export default DynamicFormNumericInput;
