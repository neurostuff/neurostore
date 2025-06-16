import { Psychology } from '@mui/icons-material';
import { Box, BoxProps, Typography } from '@mui/material';
import React from 'react';

const AIICon: React.FC<BoxProps> = (props) => {
    return (
        <Box {...props} sx={{ display: 'flex', alignItems: 'center', color: '#50b9db', ...props.sx }}>
            <Psychology sx={{ height: '20px' }} />
            <Typography variant="body2" title="Artificial Intelligence">
                AI
            </Typography>
        </Box>
    );
};

export default AIICon;
