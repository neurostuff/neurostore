import { CircularProgress } from '@mui/material';
import { Box } from '@mui/system';

export interface INeurosynthLoader {
    loaded: boolean;
    loadingText?: string;
}

const NeurosynthLoader: React.FC<INeurosynthLoader> = (props) => {
    return (
        <>
            {props.loaded ? (
                <>{props.children}</>
            ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                    {props.loadingText && <Box sx={{ margin: '0.5rem' }}>Fetching datasets</Box>}
                </Box>
            )}
        </>
    );
};

export default NeurosynthLoader;
