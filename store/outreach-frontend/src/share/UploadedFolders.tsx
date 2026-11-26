import { Box, Button, Collapse, IconButton, Stack, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderIcon from '@mui/icons-material/Folder';
import { useState } from 'react';
import { byUploadFolder, formatBytes } from './review';
import type { ShareView } from './types';

/** Folders longer than this start folded; the header's count says what is inside. */
const OPEN_UNTIL = 6;

/** What has been uploaded, under a header for each folder it came from. */
export function UploadedFolders({
    view,
    disabled,
    onRemove,
}: {
    view: ShareView;
    disabled: boolean;
    onRemove: (ids: string[]) => void;
}) {
    const groups = byUploadFolder(view);
    if (groups.length === 0) return null;
    return (
        <Stack spacing={2} sx={{ mt: 3 }}>
            {groups.map((group) => (
                <FolderGroup
                    key={group.folder ?? ''}
                    title={group.folder ?? 'Individual files'}
                    files={group.uploads}
                    disabled={disabled}
                    onRemove={onRemove}
                />
            ))}
        </Stack>
    );
}

function FolderGroup({
    title,
    files,
    disabled,
    onRemove,
}: {
    title: string;
    files: ReturnType<typeof byUploadFolder>[number]['uploads'];
    disabled: boolean;
    onRemove: (ids: string[]) => void;
}) {
    const [open, setOpen] = useState(files.length <= OPEN_UNTIL);
    const problems = files.filter(({ upload }) => upload.check_status !== 'ok').length;
    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                    color="inherit"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    sx={{ minWidth: 0, p: 0, textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left' }}
                >
                    <FolderIcon aria-hidden sx={{ fontSize: 22, mr: 1, color: 'text.secondary' }} />
                    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 400, overflowWrap: 'anywhere' }}>
                        {title}
                    </Typography>
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                    {problems > 0 && ` · ${problems} could not be read`}
                </Typography>
                <Button
                    size="small"
                    color="inherit"
                    disabled={disabled}
                    aria-label={`Remove ${title}`}
                    onClick={() => onRemove(files.map(({ upload }) => upload.id))}
                >
                    Remove
                </Button>
            </Stack>
            <Collapse in={open} timeout="auto">
                <Stack spacing={0.25} sx={{ pt: 0.5, pl: 4 }}>
                    {files.map(({ upload, inside }) => (
                        <Stack key={upload.id} direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
                                {inside}
                                <Typography component="span" variant="body2" color="text.secondary">
                                    {' '}
                                    · {formatBytes(upload.size_bytes)}
                                    {upload.check_status !== 'ok' && ` · ${upload.problem ?? 'could not be read'}`}
                                </Typography>
                            </Typography>
                            <IconButton
                                size="small"
                                color="error"
                                disabled={disabled}
                                aria-label={`Remove ${upload.path ?? upload.filename}`}
                                onClick={() => onRemove([upload.id])}
                                sx={{ width: 28, height: 28, p: 0, flexShrink: 0 }}
                            >
                                <DeleteOutlineIcon aria-hidden sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Stack>
                    ))}
                </Stack>
            </Collapse>
        </Box>
    );
}
