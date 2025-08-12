import { CloudDone, CloudQueue, Cloud } from '@mui/icons-material';
import { Box, CircularProgress, Tooltip } from '@mui/material';

const LoadingStateIndicator: React.FC<{ isLoading?: boolean; hasUnsavedchanges?: boolean; isError?: boolean }> = ({
    isLoading = false,
    hasUnsavedchanges = false,
    isError = false,
}) => {
    return (
        <Box sx={{ height: '100%', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLoading ? (
                <CircularProgress size={18} />
            ) : isError ? (
                <Tooltip title="Update Error">
                    <Cloud color="error" />
                </Tooltip>
            ) : hasUnsavedchanges ? (
                <Tooltip title="Unsaved changes">
                    <CloudQueue color="warning" />
                </Tooltip>
            ) : (
                <Tooltip title="Up to date">
                    <CloudDone color="primary" />
                </Tooltip>
            )}
        </Box>
    );
};

export default LoadingStateIndicator;
