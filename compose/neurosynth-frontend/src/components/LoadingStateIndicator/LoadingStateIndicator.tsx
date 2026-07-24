import { CloudDone, CloudQueue, Cloud } from '@mui/icons-material';
import { Box, CircularProgress, Tooltip } from '@mui/material';

const LoadingStateIndicator = ({ 
    isLoading = false,
    hasUnsavedchanges = false,
    isError = false,
 }: { isLoading?: boolean; hasUnsavedchanges?: boolean; isError?: boolean }) => {
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
