import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    ListItem,
    ListItemButton,
    Menu,
    Tooltip,
    Typography,
} from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { setAnalysesInAnnotationAsIncluded } from 'helpers/Annotation.helpers';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetBaseStudyById from 'hooks/studies/useGetBaseStudyById';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { updateExtractionTableStateInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import {
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { useStudyBaseStudyId, useStudyId } from 'pages/Study/store/StudyStore';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnotationId } from 'stores/AnnotationStore.getters';

const EditStudySwapVersionButton: React.FC = (props) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);
    const baseStudyId = useStudyBaseStudyId();
    const projectId = useProjectId();
    const studyId = useStudyId();
    const { data: baseStudy } = useGetBaseStudyById(baseStudyId || '');
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const updateStudyListStatusWithNewStudyId = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, false);
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const annotationId = useAnnotationId();

    const [isSwapping, setIsSwapping] = useState(false);
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
        setConfirmationDialogState((prev) => ({
            ...prev,
            isOpen: false,
            selectedVersion: undefined,
        }));
    };

    const handleSwapStudy = async (versionToSwapTo?: string) => {
        if (!annotationId || !studyId || !studysetId || !versionToSwapTo || !studyset?.studies)
            return;
        if (versionToSwapTo === studyId) {
            handleCloseNavMenu();
            return;
        }
        setIsSwapping(true);
        try {
            handleCloseNavMenu();
            const updatedStudyset = [...(studyset.studies as string[])];

            const currentStudyBeingEditedIndex = updatedStudyset.findIndex(
                (study) => study === studyId
            );
            if (currentStudyBeingEditedIndex < 0) throw new Error('study not found in studyset');

            updatedStudyset[currentStudyBeingEditedIndex] = versionToSwapTo;
            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: updatedStudyset,
                },
            });
            updateStudyListStatusWithNewStudyId(studyId, versionToSwapTo);
            updateExtractionTableStateInStorage(projectId, studyId, versionToSwapTo);
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

    const handleSelectVersion = (versionId: string | undefined) => {
        if (!versionId) return;
        if (versionId === studyId) {
            handleCloseNavMenu();
            return;
        }
        setConfirmationDialogState({
            isOpen: true,
            selectedVersion: versionId,
        });
    };

    const baseStudyVersions = useMemo(() => {
        const baseVersions = (baseStudy?.versions || []) as StudyReturn[];
        return baseVersions.sort(lastUpdatedAtSortFn).reverse();
    }, [baseStudy?.versions]);

    return (
        <>
            <Box>
                <Tooltip title="Swap study version" placement="left">
                    <Button
                        color="secondary"
                        variant="contained"
                        disableElevation
                        onClick={handleButtonPress}
                        size="small"
                        sx={{ width: '40px', minWidth: '40px', height: '40px' }}
                    >
                        {isSwapping ? <CircularProgress size={20} /> : <SwapHorizIcon />}
                    </Button>
                </Tooltip>
            </Box>
            <ConfirmationDialog
                dialogTitle="Are you sure you want to switch the study version?"
                dialogMessage={
                    <>
                        <Typography>
                            You are switching from version {studyId} to version
                            {confirmationDialogState.selectedVersion || ''}
                        </Typography>
                        <Typography gutterBottom sx={{ color: 'error.main', marginBottom: '1rem' }}>
                            Warning: switching versions will remove any annotations you have created
                            for this study.
                        </Typography>
                    </>
                }
                onCloseDialog={handleCloseConfirmationDialog}
                isOpen={confirmationDialogState.isOpen}
                rejectText="Cancel"
            />
            <Menu
                open={open}
                onClose={handleCloseNavMenu}
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                {baseStudyVersions.map((baseStudyVersion) => {
                    const isCurrentlySelected = baseStudyVersion.id === studyId;
                    const username = baseStudyVersion.username
                        ? baseStudyVersion.username
                        : 'neurosynth';

                    return (
                        <ListItem key={baseStudyVersion.id} sx={{ padding: '0.2rem 1rem' }}>
                            <ListItemButton
                                selected={isCurrentlySelected}
                                sx={{ ':hover': { backgroundColor: 'transparent' }, py: '0' }}
                            >
                                <ButtonGroup variant="text">
                                    <Button
                                        onClick={() => handleSelectVersion(baseStudyVersion.id)}
                                        sx={{ width: '450px' }}
                                    >
                                        Switch to version {baseStudyVersion.id} | Owner: {username}
                                    </Button>
                                    <Button
                                        href={`/base-studies/${baseStudyId}/${studyId}`}
                                        target="_blank"
                                        rel="noreferrer"
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
