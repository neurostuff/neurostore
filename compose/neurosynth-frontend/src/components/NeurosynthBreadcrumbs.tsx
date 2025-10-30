import { Box, Breadcrumbs, Link, Tooltip, Typography } from '@mui/material';
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
        <Box>
            <ConfirmationDialog
                isOpen={confirmationDialogState.isOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleCloseConfirmationDialog}
                rejectText="Cancel"
                confirmText="Continue"
            />

            <Breadcrumbs sx={{ ol: { display: 'flex', flexWrap: 'nowrap' } }}>
                {props.breadcrumbItems.map((breadcrumb, index) =>
                    breadcrumb.isCurrentPage ? (
                        <Tooltip placement="top" key={index} title={breadcrumb.text}>
                            <Typography
                                key={index}
                                color="secondary"
                                sx={{ maxWidth: '250px' }}
                                variant="h5"
                                className="line-clamp-1"
                            >
                                {breadcrumb.text}
                            </Typography>
                        </Tooltip>
                    ) : (
                        <Tooltip placement="top" key={index} title={breadcrumb.text}>
                            <Link
                                component={NavLink}
                                to={breadcrumb.link}
                                variant="h5"
                                sx={{ maxWidth: '250px' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleNavigate(breadcrumb.link);
                                }}
                                className="line-clamp-1"
                                underline="hover"
                            >
                                {breadcrumb.text}
                            </Link>
                        </Tooltip>
                    )
                )}
            </Breadcrumbs>
        </Box>
    );
});

export default NeurosynthBreadcrumbs;
