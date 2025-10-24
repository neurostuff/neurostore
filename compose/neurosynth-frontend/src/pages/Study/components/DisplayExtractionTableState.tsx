import { ArrowLeft, ArrowRight } from '@mui/icons-material';
import { Box, Button, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useGetStudyById, useGetStudysetById, useUserCanEdit } from 'hooks';
import { retrieveExtractionTableState } from 'pages/Extraction/components/ExtractionTable.helpers';
import { useProjectExtractionStudysetId, useProjectId, useProjectUser } from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import React from 'react';

const DisplayExtractionTableState: React.FC = () => {
    const projectId = useProjectId();
    const studyId = useStudyId();
    const studysetId = useProjectExtractionStudysetId();
    const { data } = useGetStudysetById(studysetId, false);
    const extractionTableState = retrieveExtractionTableState(projectId);
    const thisStudyIndex = (extractionTableState?.studies || []).indexOf(studyId || '');
    const prevStudyId = extractionTableState?.studies[thisStudyIndex - 1];
    const nextStudyId = extractionTableState?.studies[thisStudyIndex + 1];

    const { data: prevStudy, isLoading: prevStudyIsLoading } = useGetStudyById(prevStudyId);
    const { data: nextStudy, isLoading: nextStudyIsLoading } = useGetStudyById(nextStudyId);

    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        action: 'PREV' | 'NEXT' | undefined;
    }>({
        isOpen: false,
        action: undefined,
    });

    const navigate = useNavigate();

    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);

    const handleMoveToPreviousStudy = () => {
        if (!prevStudyId) throw new Error('no previous study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'PREV',
            });
            return;
        }

        if (canEdit) {
            navigate(`/projects/${projectId}/extraction/studies/${prevStudyId}/edit`);
        } else {
            navigate(`/projects/${projectId}/extraction/studies/${prevStudyId}`);
        }
    };

    const handleMoveToNextStudy = () => {
        if (!nextStudyId) throw new Error('no next study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'NEXT',
            });
            return;
        }

        if (canEdit) {
            navigate(`/projects/${projectId}/extraction/studies/${nextStudyId}/edit`);
        } else {
            navigate(`/projects/${projectId}/extraction/studies/${nextStudyId}`);
        }
    };

    const handleConfirmationDialogClose = (ok: boolean | undefined) => {
        if (!ok) {
            setConfirmationDialogState({
                isOpen: false,
                action: undefined,
            });
        } else {
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            switch (confirmationDialogState.action) {
                case 'PREV':
                    handleMoveToPreviousStudy();
                    break;
                case 'NEXT':
                    handleMoveToNextStudy();
                    break;
            }
            setConfirmationDialogState({
                isOpen: false,
                action: undefined,
            });
        }
    };

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

    const filterStr = (extractionTableState?.columnFilters || []).reduce((acc, curr, index) => {
        if (index === 0) return `Filtering by ${curr.id}: ${curr.value || 'All'}`;
        return `${acc}, ${curr.id}: ${curr.value || 'All'}`;
    }, '');

    const sortingStr = (extractionTableState?.sorting || []).reduce((acc, curr, index) => {
        if (index === 0) {
            return `Sorting by ${curr.id}: ${curr.desc ? 'desc' : 'asc'}`;
        }
        return `${acc}, ${curr.id}: ${curr.desc ? 'desc' : 'asc'}`;
    }, '');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ConfirmationDialog
                isOpen={confirmationDialogState.isOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleConfirmationDialogClose}
                rejectText="Cancel"
                confirmText="Continue"
            />
            {prevStudyId ? (
                <Tooltip title={prevStudy?.name || ''} placement="top">
                    <Button
                        onClick={handleMoveToPreviousStudy}
                        startIcon={<ArrowLeft />}
                        disableElevation
                        sx={{
                            backgroundColor: '#f5f5f5',
                            color: 'black',
                            height: '100%',
                            ':hover': { backgroundColor: 'lightblue' },
                        }}
                    >
                        {!mdDown && (
                            <Typography
                                sx={{
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100px',
                                    width: '100px',
                                    fontSize: '8px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textAlign: 'start',
                                }}
                                fontSize="0.6rem"
                            >
                                {prevStudyIsLoading ? 'Loading...' : prevStudy?.name || ''}
                            </Typography>
                        )}
                    </Button>
                </Tooltip>
            ) : (
                <Box sx={{ width: '100px' }}></Box>
            )}
            <Tooltip
                title={
                    filterStr.length === 0 && sortingStr.length === 0 ? undefined : (
                        <>
                            {filterStr && (
                                <Typography variant="caption" sx={{ display: 'block' }}>
                                    {filterStr}
                                </Typography>
                            )}
                            {sortingStr && (
                                <Typography variant="caption" sx={{ display: 'block' }}>
                                    {sortingStr}
                                </Typography>
                            )}
                        </>
                    )
                }
            >
                <Box
                    sx={{
                        marginX: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography sx={{ display: 'block', fontSize: '10px' }}>
                        {thisStudyIndex + 1} of {(extractionTableState?.studies || []).length}
                        <span style={{ color: 'gray', marginLeft: '4px' }}>({data?.studies?.length || 0} total)</span>
                    </Typography>
                    <Typography sx={{ display: 'block', fontSize: '10px' }}>
                        {(extractionTableState?.columnFilters || []).length > 0 && (
                            <>{(extractionTableState?.columnFilters || []).length} filters</>
                        )}
                        {(extractionTableState?.sorting || []).map((sorting) => (
                            <React.Fragment key={sorting.id}>
                                {(extractionTableState?.columnFilters || []).length > 0 ? ', ' : ''}
                                sorting by {sorting.id}
                            </React.Fragment>
                        ))}
                    </Typography>
                </Box>
            </Tooltip>
            {nextStudyId ? (
                <Tooltip title={nextStudy?.name || ''} placement="top">
                    <Button
                        onClick={handleMoveToNextStudy}
                        endIcon={<ArrowRight />}
                        disableElevation
                        sx={{
                            backgroundColor: '#f5f5f5',
                            height: '100%',
                            color: 'black',
                            ':hover': { backgroundColor: 'lightblue' },
                        }}
                    >
                        {!mdDown && (
                            <Typography
                                sx={{
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100px',
                                    width: '100px',
                                    fontSize: '8px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textAlign: 'end',
                                }}
                                fontSize="0.6rem"
                            >
                                {nextStudyIsLoading ? 'Loading...' : nextStudy?.name || ''}
                            </Typography>
                        )}
                    </Button>
                </Tooltip>
            ) : (
                <Box sx={{ width: '100px' }}></Box>
            )}
        </Box>
    );
};

export default DisplayExtractionTableState;
