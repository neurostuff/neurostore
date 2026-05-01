import { Check } from '@mui/icons-material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import QuestionMark from '@mui/icons-material/QuestionMark';
import { Box, Button, ButtonGroup, Tooltip, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import {
    IExtractionTableState,
    retrieveExtractionTableState,
} from 'pages/Extraction/components/ExtractionTable.helpers';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatus,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { useStudyId } from 'stores/study/StudyStore';

const statusSizeHeight = 60;

const largeToolbarButtonSx = {
    height: `${statusSizeHeight}px`,
    display: 'flex',
    flexDirection: 'column',
} as const;

const toolbarLabelSx = {
    fontSize: '11px',
    lineHeight: 'normal',
    whiteSpace: 'wrap',
    color: 'black',
    fontWeight: 'bold',
} as const;

const EditStudyToolbarNext: React.FC = () => {
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        action: 'PREV' | 'NEXT' | 'COMPLETE' | undefined;
    }>({
        isOpen: false,
        action: undefined,
    });
    const navigate = useNavigate();

    const projectId = useProjectId();
    const studyId = useStudyId();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');

    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);

    const studysetId = useProjectExtractionStudysetId();
    const { data, isLoading, isError } = useGetStudysetById(studysetId || '', false, false);

    const [extractionTableState, setExtractionTableState] = useState<IExtractionTableState>({
        columnFilters: [],
        sorting: [],
        studies: [],
        pagination: { pageIndex: 0, pageSize: 25 },
    });

    useEffect(() => {
        if (isLoading || isError) return;
        const stateFromSessionStorage = retrieveExtractionTableState(projectId);

        if (!stateFromSessionStorage || stateFromSessionStorage.studies.length === 0) {
            setExtractionTableState((prev) => ({
                ...prev,
                studies: (data?.studies ?? []) as string[],
            }));
        } else {
            setExtractionTableState(stateFromSessionStorage);
        }
    }, [data?.studies, isError, isLoading, projectId]);

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleUpdateExtractionStatus = (status: EExtractionStatus) => {
        if (studyId) {
            updateStudyListStatus(studyId, status);
        }
    };

    const handleMoveToPreviousStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const prevId = extractionTableState.studies[index - 1];
        if (!prevId) throw new Error('no previous study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'PREV',
            });
            return;
        }

        if (canEdit) {
            navigate(`/projects/${projectId}/extraction/studies/${prevId}/edit`);
        } else {
            navigate(`/projects/${projectId}/extraction/studies/${prevId}`);
        }
    };

    const handleMoveToNextStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const nextId = extractionTableState.studies[index + 1];
        if (!nextId) throw new Error('no next study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'NEXT',
            });
            return;
        }

        if (canEdit) {
            navigate(`/projects/${projectId}/extraction/studies/${nextId}/edit`);
        } else {
            navigate(`/projects/${projectId}/extraction/studies/${nextId}`);
        }
    };

    const handleMoveToComplete = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'COMPLETE',
            });
            return;
        }

        navigate(`/projects/${projectId}/project`, {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            } as IProjectPageLocationState,
        });
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
                case 'COMPLETE':
                    handleMoveToComplete();
                    break;
                default:
                    return;
            }
            setConfirmationDialogState({
                isOpen: false,
                action: undefined,
            });
        }
    };

    const isUnreviewed = extractionStatus === undefined || extractionStatus?.status === EExtractionStatus.UNCATEGORIZED;
    const isSavedForLater = extractionStatus?.status === EExtractionStatus.SAVEDFORLATER;
    const isCompleted = extractionStatus?.status === EExtractionStatus.COMPLETED;

    return (
        <Box>
            <ConfirmationDialog
                isOpen={confirmationDialogState.isOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleConfirmationDialogClose}
                rejectText="Cancel"
                confirmText="Continue"
            />

            <ButtonGroup color="info" size="large" variant="outlined">
                <Tooltip title="Mark as unreviewed" placement="top">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.UNCATEGORIZED)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        color="warning"
                        variant={isUnreviewed ? 'contained' : 'outlined'}
                    >
                        <QuestionMark style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color: isUnreviewed ? 'white' : 'warning.dark',
                                },
                            ]}
                        >
                            Unreviewed
                        </Typography>
                    </Button>
                </Tooltip>
                <Tooltip title="Save for later" placement="top">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.SAVEDFORLATER)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        variant={isSavedForLater ? 'contained' : 'outlined'}
                    >
                        <BookmarkIcon style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color: isSavedForLater ? 'white' : 'info.dark',
                                },
                            ]}
                        >
                            Save for later
                        </Typography>
                    </Button>
                </Tooltip>
                <Tooltip title="Complete" placement="top">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.COMPLETED)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        color="success"
                        variant={isCompleted ? 'contained' : 'outlined'}
                    >
                        <Check style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color: isCompleted ? 'white' : 'success.dark',
                                },
                            ]}
                        >
                            Complete
                        </Typography>
                    </Button>
                </Tooltip>
            </ButtonGroup>
        </Box>
    );
};

export default EditStudyToolbarNext;
