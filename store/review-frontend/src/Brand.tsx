import { Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function Brand() {
    return (
        <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 300 }}
        >
            neurostore review
        </Typography>
    );
}
