import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import React, { memo, useState } from 'react';
import { STUDY_ANNOTATION_COLUMN_HEADER_MENU_ITEMS } from './editStudyAnalysisBoard.constants';

export const AnnotationColumnHeader = memo(function AnnotationColumnHeader({ headerName }: { headerName: string }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
                {STUDY_ANNOTATION_COLUMN_HEADER_MENU_ITEMS.map((label) => (
                    <MenuItem key={label} dense onClick={handleClose}>
                        {label}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
});
