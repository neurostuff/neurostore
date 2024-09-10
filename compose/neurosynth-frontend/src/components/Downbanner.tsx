import { Cancel } from '@mui/icons-material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, IconButton } from '@mui/material';
import BaseNavigationStyles from 'pages/BaseNavigation/BaseNavigation.styles';
import { useState } from 'react';

const Downbanner: React.FC = () => {
    const shouldHide = !!localStorage.getItem('hide-downbanner-sep-13-2024');
    const [hideBanner, setHideBanner] = useState(shouldHide);

    if (hideBanner) return <></>;

    return (
        <Box
            sx={{
                backgroundColor: 'secondary.main',
                color: 'primary.contrastText',
                width: '100%',
                paddingY: '0.5rem',
            }}
        >
            <Box
                sx={[
                    BaseNavigationStyles.pagesContainer,
                    {
                        marginY: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    },
                ]}
            >
                <Box display="flex" alignItems="center">
                    <ErrorOutlineIcon sx={{ mr: '1rem' }} />
                    Neurosynth-compose will be undergoing planned maintenance and will be offline on
                    friday (Sep/13/2024)
                </Box>
                <IconButton
                    onClick={() => {
                        localStorage.setItem('hide-downbanner-sep-13-2024', 'true');
                        setHideBanner(true);
                    }}
                    sx={{ padding: 0, ':hover': { backgroundColor: 'secondary.light' } }}
                >
                    <Cancel />
                </IconButton>
            </Box>
        </Box>
    );
};

export default Downbanner;
