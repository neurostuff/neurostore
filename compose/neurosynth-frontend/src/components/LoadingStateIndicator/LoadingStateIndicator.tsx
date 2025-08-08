import { CloudDone, CloudQueue } from '@mui/icons-material';
import { Box, CircularProgress, Tooltip } from '@mui/material';

const LoadingStateIndicator: React.FC<{ isLoading?: boolean; hasUnsavedchanges?: boolean }> = ({
    isLoading = false,
    hasUnsavedchanges = false,
}) => {
    return (
        <Box sx={{ height: '100%', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLoading ? (
                <CircularProgress size={18} />
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
