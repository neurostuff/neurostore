import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import useCopyToClipboard from 'hooks/useCopyToClipboard';

const CopyableId: React.FC<{ label: string; id: string | null | undefined }> = ({ label, id }) => {
    const { copied, copyToClipboard } = useCopyToClipboard();

    if (!id) return null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Typography variant="caption" sx={{ color: 'muted.main' }}>
                {label}:
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {id}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
                <IconButton size="small" aria-label={`Copy ${label}`} onClick={() => copyToClipboard(id)}>
                    {copied ? <CheckIcon fontSize="inherit" color="success" /> : <ContentCopyIcon fontSize="inherit" />}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default CopyableId;
