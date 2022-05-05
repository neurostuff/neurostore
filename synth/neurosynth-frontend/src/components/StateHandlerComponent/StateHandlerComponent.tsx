import { CircularProgress, Typography } from '@mui/material';

export interface IStateHandlerComponent {
    isError: boolean;
    errorMessage?: string;
    isLoading: boolean;
    loadingText?: string;
}

const StateHandlerComponent: React.FC<IStateHandlerComponent> = (props) => {
    if (props.isError) {
        return <Typography>{props.errorMessage || 'There was an error'}</Typography>;
    }

    if (props.isLoading) {
        return (
            <>
                <CircularProgress />
                <Typography>{props.loadingText || ''}</Typography>
            </>
        );
    }

    return <>{props.children}</>;
};

export default StateHandlerComponent;
