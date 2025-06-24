import { Box, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';
import React from 'react';

export interface IStateHandlerComponent {
    isError: boolean;
    errorMessage?: string | React.ReactNode;
    isLoading: boolean;
    loadingText?: string;
    loadingColor?: string;
    disableShrink?: boolean;
    loaderSize?: number;
}

const StateHandlerComponent: React.FC<IStateHandlerComponent> = (props) => {
    if (props.isError) {
        if (typeof props.errorMessage === 'string') {
            return <Typography sx={{ color: 'error.main' }}>{props.errorMessage}</Typography>;
        } else {
            return <>{props.errorMessage}</>;
        }
    }

    if (props.isLoading) {
        return (
            <Box
                sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <ProgressLoader
                    size={props.loaderSize}
                    disableShrink={props.disableShrink === undefined ? true : props.disableShrink}
                    sx={{ color: props.loadingColor, marginRight: '10px' }}
                />
                <Typography>{props.loadingText || ''}</Typography>
            </Box>
        );
    }

    return <>{props.children}</>;
};

export default StateHandlerComponent;
