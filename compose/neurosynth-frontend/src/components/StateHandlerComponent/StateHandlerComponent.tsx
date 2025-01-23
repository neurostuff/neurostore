import { Typography, Box } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';

export interface IStateHandlerComponent {
    isError: boolean;
    errorMessage?: string;
    isLoading: boolean;
    loadingText?: string;
    loadingColor?: string;
    disableShrink?: boolean;
    loaderSize?: number;
}

const StateHandlerComponent: React.FC<IStateHandlerComponent> = (props) => {
    if (props.isError) {
        return <Typography sx={{ color: 'error.main' }}>{props.errorMessage || 'There was an error'}</Typography>;
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
