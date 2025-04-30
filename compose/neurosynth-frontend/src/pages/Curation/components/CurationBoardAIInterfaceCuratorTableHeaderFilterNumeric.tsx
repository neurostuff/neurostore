import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { Box } from '@mui/system';
import DebouncedTextField from 'components/DebouncedTextField';

const CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric: React.FC<{
    value: [number | undefined, number | undefined] | undefined;
    onChange: (arg: [number | undefined, number | undefined] | undefined) => void;
}> = ({ value, onChange }) => {
    const min = value?.[0];
    const max = value?.[1];

    const handleChange = (min: number | string | undefined, max: number | string | undefined) => {
        const newMin = min === '' || min === undefined ? undefined : typeof min === 'string' ? parseInt(min) : min;
        const newMax = max === '' || max === undefined ? undefined : typeof max === 'string' ? parseInt(max) : max;
        if (newMin === undefined && newMax === undefined) {
            onChange(undefined);
        } else {
            onChange([newMin, newMax]);
        }
    };

    return (
        <Box sx={{ padding: '0.5rem', width: '210px', display: 'flex', justifyContent: 'space-between' }}>
            <DebouncedTextField
                size="small"
                type="number"
                placeholder="Min"
                value={(min ?? '').toString()}
                sx={{
                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                    width: '100px',
                    input: { fontSize: '12px' },
                }}
                onChange={(val) => {
                    handleChange(val, max);
                }}
                InputProps={{
                    endAdornment: (
                        <IconButton
                            size="small"
                            onClick={() => {
                                onChange([undefined, max]);
                            }}
                        >
                            <Close />
                        </IconButton>
                    ),
                }}
            />
            <DebouncedTextField
                size="small"
                type="number"
                placeholder="Max"
                value={(max ?? '').toString()}
                sx={{
                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                    width: '100px',
                    input: { fontSize: '12px' },
                }}
                onChange={(val) => {
                    onChange([min, val === undefined ? val : parseInt(val)]);
                }}
                InputProps={{
                    endAdornment: (
                        <IconButton
                            size="small"
                            onClick={() => {
                                onChange([min, undefined]);
                            }}
                        >
                            <Close />
                        </IconButton>
                    ),
                }}
            />
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric;
