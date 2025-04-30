import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { Box } from '@mui/system';
import DebouncedTextField from 'components/DebouncedTextField';

const CurationBoardAIInterfaceCuratorTableHeaderFilterText: React.FC<{
    onChange: (value: string | undefined) => void;
    value: string | undefined;
}> = ({ onChange, value }) => {
    return (
        <Box sx={{ padding: '0.5rem' }}>
            <DebouncedTextField
                size="small"
                placeholder="Filter"
                value={value as string}
                sx={{
                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                    width: '200px',
                    input: { fontSize: '12px' },
                }}
                onChange={onChange}
                InputProps={{
                    endAdornment: (
                        <IconButton size="small" onClick={() => onChange(undefined)}>
                            <Close />
                        </IconButton>
                    ),
                }}
            />
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilterText;
