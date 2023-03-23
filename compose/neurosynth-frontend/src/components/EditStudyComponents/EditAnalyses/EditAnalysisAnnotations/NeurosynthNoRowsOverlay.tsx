import { Box, Typography } from '@mui/material';

const NeurosynthNoRowsOverlay: React.FC = (props) => {
    return (
        <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '52px' }}
        >
            <Typography>No analyses to annotate</Typography>
        </Box>
    );
};

export default NeurosynthNoRowsOverlay;
