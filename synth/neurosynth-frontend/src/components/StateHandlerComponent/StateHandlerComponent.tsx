import { CircularProgress, Typography, Box } from '@mui/material';

export interface IStateHandlerComponent {
    isError: boolean;
    errorMessage?: string;
    isLoading: boolean;
    loadingText?: string;
}

const StateHandlerComponent: React.FC<IStateHandlerComponent> = (props) => {
    if (props.isError) {
        return (
            <Typography sx={{ color: 'error.main' }}>
                {props.errorMessage || 'There was an error'}
            </Typography>
        );
    }

    if (props.isLoading) {
        return (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
                <Typography>{props.loadingText || ''}</Typography>
            </Box>
        );
    }

    return <>{props.children}</>;
};

export default StateHandlerComponent;
