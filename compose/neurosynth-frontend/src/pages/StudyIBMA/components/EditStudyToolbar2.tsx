import { Check, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import QuestionMark from '@mui/icons-material/QuestionMark';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, ButtonGroup, Divider, Tooltip, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import {
    IExtractionTableState,
    retrieveExtractionTableState,
} from 'pages/Extraction/components/ExtractionTable.helpers';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatus,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import EditStudySwapVersionButton from 'pages/StudyCBMA/components/EditStudySwapVersionButton';
import useSaveStudy from 'pages/StudyCBMA/hooks/useSaveStudy';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudyId } from 'stores/study/StudyStore';
import { STUDY_ANALYSIS_TABLE_MAX_HEIGHT } from './editStudyAnalysisBoard.constants';

const statusSizeWidth = 80;
const statusSizeHeight = 70;

const largeToolbarButtonSx = {
    width: `${statusSizeWidth}px`,
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

const EditStudyToolbar2: React.FC = () => {
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        action: 'PREV' | 'NEXT' | 'COMPLETE' | undefined;
    }>({
        isOpen: false,
        action: undefined,
    });
    const { isLoading: saveStudyIsLoading, hasEdits, handleSave } = useSaveStudy();
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

    const hasPrevStudies = useMemo(() => {
        const studies = extractionTableState.studies;
        const index = studies.indexOf(studyId || '');
        return index - 1 >= 0;
    }, [extractionTableState.studies, studyId]);

    const hasNextStudies = useMemo(() => {
        const studies = extractionTableState.studies;
        const index = studies.indexOf(studyId || '');
        return index + 1 < studies.length;
    }, [extractionTableState.studies, studyId]);

    return (
        <Box
            className="sleek-scrollbar"
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                maxHeight: `${STUDY_ANALYSIS_TABLE_MAX_HEIGHT}`,
                overflow: 'auto',
                padding: '0.5rem',
            }}
        >
            <ConfirmationDialog
                isOpen={confirmationDialogState.isOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleConfirmationDialogClose}
                rejectText="Cancel"
                confirmText="Continue"
            />

            <ButtonGroup color="info" size="large" orientation="vertical">
                <Tooltip title="Mark as unreviewed" placement="left">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.UNCATEGORIZED)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        color="warning"
                        variant={extractionStatus?.status === EExtractionStatus.UNCATEGORIZED ? 'contained' : 'text'}
                    >
                        <QuestionMark style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color:
                                        extractionStatus?.status === EExtractionStatus.UNCATEGORIZED
                                            ? 'white'
                                            : 'warning.dark',
                                },
                            ]}
                        >
                            Unreviewed
                        </Typography>
                    </Button>
                </Tooltip>
                <Tooltip title="Save for later" placement="left">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.SAVEDFORLATER)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        variant={extractionStatus?.status === EExtractionStatus.SAVEDFORLATER ? 'contained' : 'text'}
                    >
                        <BookmarkIcon style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color:
                                        extractionStatus?.status === EExtractionStatus.SAVEDFORLATER
                                            ? 'white'
                                            : 'info.dark',
                                },
                            ]}
                        >
                            Save for later
                        </Typography>
                    </Button>
                </Tooltip>
                <Tooltip title="Complete" placement="left">
                    <Button
                        onClick={() => handleUpdateExtractionStatus(EExtractionStatus.COMPLETED)}
                        sx={largeToolbarButtonSx}
                        disableElevation
                        color="success"
                        variant={extractionStatus?.status === EExtractionStatus.COMPLETED ? 'contained' : 'text'}
                    >
                        <Check style={{ marginBottom: '4px' }} />
                        <Typography
                            sx={[
                                toolbarLabelSx,
                                {
                                    color:
                                        extractionStatus?.status === EExtractionStatus.COMPLETED
                                            ? 'white'
                                            : 'success.dark',
                                },
                            ]}
                        >
                            Complete
                        </Typography>
                    </Button>
                </Tooltip>
            </ButtonGroup>

            <Box sx={{ width: '100%', my: 1 }}>
                <Divider sx={{ width: '100%' }} />
            </Box>

            <Box>
                <EditStudySwapVersionButton
                    buttonProps={{ sx: largeToolbarButtonSx, variant: 'text' }}
                    buttonLabel="Switch version"
                    buttonLabelProps={{ sx: toolbarLabelSx }}
                />
                <Tooltip title={!hasEdits ? 'No edits to save' : 'Save'} placement="left">
                    <Box>
                        <Button
                            disabled={!hasEdits}
                            disableElevation
                            onClick={handleSave}
                            variant={hasEdits ? 'contained' : 'text'}
                            color="primary"
                            sx={largeToolbarButtonSx}
                        >
                            {saveStudyIsLoading ? (
                                <ProgressLoader color="secondary" size={24} />
                            ) : (
                                <>
                                    <SaveIcon style={{ marginBottom: '4px' }} />
                                    <Typography sx={[toolbarLabelSx, { color: hasEdits ? 'white' : 'gray' }]}>
                                        Save
                                    </Typography>
                                </>
                            )}
                        </Button>
                    </Box>
                </Tooltip>
            </Box>

            <Box sx={{ width: '100%', my: 1 }}>
                <Divider sx={{ width: '100%' }} />
            </Box>

            <Box>
                <ButtonGroup color="info" size="large" orientation="vertical">
                    <Tooltip title={hasPrevStudies ? `go to previous study` : `no more studies`} placement="left">
                        <Box>
                            <Button
                                variant="text"
                                onClick={handleMoveToPreviousStudy}
                                disableElevation
                                disabled={!hasPrevStudies}
                                sx={largeToolbarButtonSx}
                            >
                                <KeyboardArrowLeft style={{ marginBottom: '4px' }} />
                                <Typography sx={[toolbarLabelSx, { color: hasPrevStudies ? 'black' : 'gray' }]}>
                                    Previous
                                </Typography>
                            </Button>
                        </Box>
                    </Tooltip>
                    <Tooltip title={hasNextStudies ? `go to next study` : `no more studies`} placement="left">
                        <Box>
                            <Button
                                variant="text"
                                onClick={handleMoveToNextStudy}
                                disableElevation
                                disabled={!hasNextStudies}
                                sx={largeToolbarButtonSx}
                            >
                                <KeyboardArrowRight style={{ marginBottom: '4px' }} />
                                <Typography sx={[toolbarLabelSx, { color: hasNextStudies ? 'black' : 'gray' }]}>
                                    Next
                                </Typography>
                            </Button>
                        </Box>
                    </Tooltip>
                </ButtonGroup>
            </Box>
        </Box>
    );
};

export default EditStudyToolbar2;
