import { AutoAwesome } from '@mui/icons-material';
import { BoxProps, Typography, Box } from '@mui/material';
import React from 'react';

const AIICon: React.FC<BoxProps> = (props) => {
    return (
        <Box {...props} sx={{ display: 'flex', alignItems: 'center', color: '#50b9db', ...props.sx }}>
            <AutoAwesome sx={{ height: '16px' }} />
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                AI
            </Typography>
        </Box>
    );
};

export default AIICon;
