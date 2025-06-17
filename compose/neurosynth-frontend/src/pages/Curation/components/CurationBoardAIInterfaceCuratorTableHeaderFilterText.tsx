import { Close } from '@mui/icons-material';
import { IconButton, TextField } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect, useState } from 'react';

const CurationBoardAIInterfaceCuratorTableHeaderFilterText: React.FC<{
    onChange: (value: string | undefined) => void;
    value: string | undefined;
    onClose: () => void;
}> = ({ onChange, value, onClose }) => {
    const [val, setVal] = useState<string | undefined>(value);

    useEffect(() => {
        const timeout = setTimeout(() => {
            onChange(val);
        }, 400);

        return () => {
            clearTimeout(timeout);
        };
    }, [onChange, val]);

    return (
        <Box sx={{ padding: '0.5rem' }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onChange(val);
                    onClose();
                }}
            >
                <TextField
                    size="small"
                    placeholder="Filter"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    sx={{
                        '.MuiInputBase-root': { paddingRight: '0px !important' },
                        width: '200px',
                        input: { fontSize: '12px' },
                    }}
                    InputProps={{
                        endAdornment: (
                            <IconButton size="small" onClick={() => onChange(undefined)}>
                                <Close />
                            </IconButton>
                        ),
                    }}
                />
            </form>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilterText;
