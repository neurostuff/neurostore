import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { memo, useState } from 'react';

const AnnotationColumnHeader = ({
    headerName,
    onRemoveColumn,
}: {
    headerName: string;
    onRemoveColumn?: (columnKey: string) => void | Promise<void>;
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
    const open = Boolean(anchorEl);
    const handleClose = () => setAnchorEl(null);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 0.25,
                width: '100%',
                minWidth: 0,
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1, minWidth: 0 }}
                noWrap
                title={headerName}
            >
                {headerName}
            </Typography>
            <Tooltip title="Column options">
                <IconButton
                    size="small"
                    aria-label={`${headerName} column options`}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : 'false'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                    }}
                    sx={{ flexShrink: 0, p: 0.25 }}
                >
                    <MoreVertIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                onClick={(e) => e.stopPropagation()}
            >
                <MenuItem
                    dense
                    sx={{ color: 'error.main' }}
                    onClick={() => {
                        handleClose();
                        setRemoveConfirmOpen(true);
                    }}
                >
                    Remove column
                </MenuItem>
            </Menu>
            <ConfirmationDialog
                isOpen={removeConfirmOpen}
                onCloseDialog={(confirm) => {
                    if (confirm) {
                        void onRemoveColumn?.(headerName);
                    }
                    setRemoveConfirmOpen(false);
                }}
                dialogTitle="Remove annotation column?"
                dialogMessage={`Remove the "${headerName}" column? This will also remove annotation data for all other studies in this studyset associated with "${headerName}"`}
                confirmText="Remove"
                rejectText="Cancel"
                confirmButtonProps={{ color: 'error' }}
            />
        </Box>
    );
};

export default memo(AnnotationColumnHeader);
