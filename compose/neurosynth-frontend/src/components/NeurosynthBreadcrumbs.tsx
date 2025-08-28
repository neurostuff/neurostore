import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface INeurosynthBreadcrumbs {
    link: string;
    text: string;
    isCurrentPage: boolean;
}

const NeurosynthBreadcrumbs: React.FC<{ breadcrumbItems: INeurosynthBreadcrumbs[] }> = React.memo((props) => {
    const [confirmationDialogState, setConfirmationDialogState] = useState({
        isOpen: false,
        navigationLink: '',
    });
    const navigate = useNavigate();

    const handleNavigate = (link: string) => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                navigationLink: link,
            });
        } else {
            navigate(link);
        }
    };

    const handleCloseConfirmationDialog = (ok: boolean | undefined) => {
        if (ok) {
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            navigate(confirmationDialogState.navigationLink);
        }

        setConfirmationDialogState({
            isOpen: false,
            navigationLink: '',
        });
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <ConfirmationDialog
                isOpen={confirmationDialogState.isOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleCloseConfirmationDialog}
                rejectText="Cancel"
                confirmText="Continue"
            />

            <Breadcrumbs>
                {props.breadcrumbItems.map((breadcrumb, index) =>
                    breadcrumb.isCurrentPage ? (
                        <Typography
                            key={index}
                            color="secondary"
                            variant="h6"
                            sx={{
                                maxWidth: '200px',
                                textOverflow: 'ellipsis',
                                display: 'block',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {breadcrumb.text}
                        </Typography>
                    ) : (
                        <Link
                            key={index}
                            component={NavLink}
                            to={breadcrumb.link}
                            onClick={(e) => {
                                e.preventDefault();
                                handleNavigate(breadcrumb.link);
                            }}
                            sx={{
                                fontSize: '1.25rem',
                                cursor: 'pointer',
                                maxWidth: '200px',
                                textOverflow: 'ellipsis',
                                display: 'block',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}
                            underline="hover"
                        >
                            {breadcrumb.text}
                        </Link>
                    )
                )}
            </Breadcrumbs>
        </Box>
    );
});

export default NeurosynthBreadcrumbs;
