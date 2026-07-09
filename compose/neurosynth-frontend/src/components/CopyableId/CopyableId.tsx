import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import useCopyToClipboard from 'hooks/useCopyToClipboard';

const CopyableId: React.FC<{ label: string; id: string | null | undefined }> = ({ label, id }) => {
    const { copied, copyToClipboard } = useCopyToClipboard();

    if (!id) return null;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '6px',
                height: '24px',
                fontSize: '0.65rem',
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    color: 'muted.dark',
                    px: 0.75,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 'inherit',
                    lineHeight: 1,
                    borderTopLeftRadius: '6px',
                    borderBottomLeftRadius: '6px',
                    bgcolor: 'grey.100',
                }}
            >
                {label}:
            </Typography>
            <Divider orientation="vertical" flexItem />
            <Typography
                variant="caption"
                sx={{ fontFamily: 'monospace', px: 0.75, fontSize: 'inherit', lineHeight: 1 }}
            >
                {id}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
                <IconButton
                    size="small"
                    aria-label={`Copy ${label}`}
                    onClick={() => copyToClipboard(id)}
                    sx={{ p: 0.25, mr: 0.25, fontSize: '0.75rem' }}
                >
                    {copied ? (
                        <CheckIcon sx={{ fontSize: '16px' }} color="success" />
                    ) : (
                        <ContentCopyIcon sx={{ fontSize: '16px' }} />
                    )}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default CopyableId;
