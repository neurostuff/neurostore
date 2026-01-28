import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
    Box,
    Button,
    ButtonGroup,
    ListItem,
    ListItemButton,
    Menu,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import { setAnalysesInAnnotationAsIncluded } from 'helpers/Annotation.helpers';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import { useGetStudysetById, useUpdateStudyset, useGetBaseStudyById } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import {
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { useStudyBaseStudyId, useStudyId, useUpdateStudyDetails } from 'pages/Study/store/StudyStore';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnotationId } from 'stores/AnnotationStore.getters';

const EditStudySwapVersionButton: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);
    const baseStudyId = useStudyBaseStudyId();
    const { data: baseStudy } = useGetBaseStudyById(baseStudyId || '');
    const projectId = useProjectId();
    const studyId = useStudyId();
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const updateStudyListStatusWithNewStudyId = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, false);
    const updateStudyByField = useUpdateStudyDetails();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const annotationId = useAnnotationId();

    const [isSwapping, setIsSwapping] = useState(false);
    const [unsavedChangesConfirmationDialog, setUnsavedChangesConfirmationDialog] = useState(false);
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        selectedVersion?: string;
    }>({
        isOpen: false,
        selectedVersion: undefined,
    });

    const handleButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorEl(null);
    };

    const handleCloseConfirmationDialog = (confirm?: boolean) => {
        if (confirm) {
            handleSwapStudy(confirmationDialogState.selectedVersion);
        }
        setConfirmationDialogState({
            isOpen: false,
            selectedVersion: undefined,
        });
    };

    /**
     * Handle swapping the current study being edited with another version.
     * The selected version is confirmed by the user in a confirmation dialog.
     * If confirmed, the studyset is updated to replace the current study with the selected version.
     * The studylist status is updated to reflect the new study version.
     * The extraction table state in storage is updated to point to the new study version.
     * The analyses in the annotation are set to be included.
     * The user is redirected to the edit page of the new study version.
     * @param {string} versionToSwapTo - the id of the version to swap to
     */
    const handleSwapStudy = async (versionToSwapTo?: string) => {
        if (!annotationId || !studyId || !studysetId || !versionToSwapTo || !studyset?.studies) return;
        if (versionToSwapTo === studyId) {
            handleCloseNavMenu();
            return;
        }
        setIsSwapping(true);
        try {
            handleCloseNavMenu();
            const updatedStudyset = [...(studyset.studies as string[])];

            const currentStudyBeingEditedIndex = updatedStudyset.findIndex((study) => study === studyId);
            if (currentStudyBeingEditedIndex < 0) throw new Error('study not found in studyset');

            updatedStudyset[currentStudyBeingEditedIndex] = versionToSwapTo;

            // Preserve curation stub linkage when swapping versions.
            const studyToStub = new Map<string, string>();
            (studyset.studyset_studies || []).forEach((assoc) => {
                if (assoc?.id && assoc?.curation_stub_uuid) {
                    studyToStub.set(assoc.id, assoc.curation_stub_uuid);
                }
            });
            const stubForCurrent = studyToStub.get(studyId);
            if (stubForCurrent) {
                studyToStub.delete(studyId);
                studyToStub.set(versionToSwapTo, stubForCurrent);
            }
            const studiesPayload = updatedStudyset.map((id) => {
                const stub = studyToStub.get(id);
                return { id, curation_stub_uuid: stub };
            });

            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studiesPayload,
                },
            });
            updateStudyListStatusWithNewStudyId(studyId, versionToSwapTo);
            updateStudyByField('id', versionToSwapTo);
            unsetUnloadHandler('study');
            updateExtractionTableStateStudySwapInStorage(projectId, studyId, versionToSwapTo);
            await setAnalysesInAnnotationAsIncluded(annotationId);

            navigate(`/projects/${projectId}/extraction/studies/${versionToSwapTo}/edit`);

            enqueueSnackbar('Updated version', { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error selecting another study version', {
                variant: 'error',
            });
        } finally {
            setIsSwapping(false);
        }
    };

    const handleCloseUnsavedChangesDialog = (ok: boolean | undefined) => {
        if (ok) {
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
        }
        setUnsavedChangesConfirmationDialog(false);
        handleCloseConfirmationDialog(ok);
    };

    const handleUnsavedChanges = (ok: boolean | undefined) => {
        if (ok) {
            const hasUnsavedChanges = hasUnsavedStudyChanges();
            if (hasUnsavedChanges) {
                setConfirmationDialogState((prev) => ({ ...prev, isOpen: false }));
                setUnsavedChangesConfirmationDialog(true);
                return;
            }
        }
        handleCloseConfirmationDialog(ok);
    };

    const handleSwitchVersion = (versionId: string | undefined) => {
        if (!versionId) return;
        if (versionId === studyId) {
            handleCloseNavMenu();
            return;
        }

        setConfirmationDialogState({ isOpen: true, selectedVersion: versionId });
    };

    const baseStudyVersions = useMemo(() => {
        const baseVersions = (baseStudy?.versions || []) as StudyReturn[];
        return baseVersions.sort(lastUpdatedAtSortFn).reverse();
    }, [baseStudy?.versions]);

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <>
            <Box>
                <Tooltip title="Swap study version" placement={mdDown ? 'bottom' : 'left'}>
                    <Button
                        color="secondary"
                        disableElevation
                        onClick={handleButtonPress}
                        size="small"
                        variant="outlined"
                        sx={{
                            width: '40px',
                            maxWidth: '40px',
                            minWidth: '40px',
                            height: '40px',
                            padding: 0,
                        }}
                    >
                        {isSwapping ? <ProgressLoader color="secondary" size={20} /> : <SwapHorizIcon />}
                    </Button>
                </Tooltip>
            </Box>
            <ConfirmationDialog
                dialogTitle="Are you sure you want to switch the study version?"
                dialogMessage={
                    <>
                        <Typography>
                            You are switching from version {studyId} to version{' '}
                            {confirmationDialogState.selectedVersion || ''}
                        </Typography>
                        <Typography gutterBottom sx={{ color: 'error.main', marginBottom: '1rem' }}>
                            Warning: switching versions will remove any annotations you have created for this study.
                        </Typography>
                    </>
                }
                onCloseDialog={handleUnsavedChanges}
                isOpen={confirmationDialogState.isOpen}
                rejectText="Cancel"
            />
            <ConfirmationDialog
                dialogTitle="Unsaved Changes"
                dialogMessage="You have unsaved changes. Are you sure you want to switch the study version? Switching the study version will remove any changes you have made"
                onCloseDialog={handleCloseUnsavedChangesDialog}
                isOpen={unsavedChangesConfirmationDialog}
                rejectText="Cancel"
            />
            <Menu open={open} onClose={handleCloseNavMenu} anchorEl={anchorEl}>
                {baseStudyVersions.map((version) => {
                    const isCurrentlySelected = version.id === studyId;
                    const username = version.username ? version.username : 'neurosynth';
                    const lastUpdated = new Date(version.updated_at || version.created_at || '').toLocaleString();

                    return (
                        <ListItem key={version.id} sx={{ padding: '0.2rem 1rem' }}>
                            <ListItemButton
                                selected={isCurrentlySelected}
                                sx={{ ':hover': { backgroundColor: 'transparent' }, p: '0' }}
                            >
                                <ButtonGroup variant="text">
                                    <Button
                                        onClick={() => handleSwitchVersion(version.id)}
                                        sx={{
                                            width: '300px',
                                            textTransform: 'none',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <Typography variant="caption" textAlign="left">
                                            Switch to version: {version.id}
                                        </Typography>
                                        <Typography variant="caption" color="gray" textAlign="left">
                                            Last Modified: {lastUpdated}
                                        </Typography>
                                        <Typography variant="caption" color="gray" textAlign="left">
                                            Owner: {username}
                                        </Typography>
                                    </Button>
                                    <Button
                                        href={`/base-studies/${baseStudyId}/${version.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ fontSize: '0.8rem' }}
                                        endIcon={<OpenInNewIcon />}
                                    >
                                        View version
                                    </Button>
                                </ButtonGroup>
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </Menu>
        </>
    );
};

export default EditStudySwapVersionButton;
