import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
    Box,
    Button,
    ButtonGroup,
    ButtonProps,
    ListItem,
    ListItemButton,
    Menu,
    Tooltip,
    Typography,
    TypographyProps,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import {
    useGetBaseStudyInfoById,
    useGetStudyNonNestedById,
    useGetStudysetNonNestedById,
    useUpdateStudyset,
} from 'hooks';
import { useSnackbar } from 'notistack';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'stores/projects/ProjectStore';

const EditStudySwapVersionButtonNext: React.FC<{
    buttonProps?: ButtonProps;
    buttonLabelProps?: TypographyProps;
    buttonLabel?: string;
}> = ({ buttonProps = {}, buttonLabelProps = {}, buttonLabel }) => {
    const { studyId } = useParams<{ projectId: string; studyId: string }>();

    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);

    const { data: study } = useGetStudyNonNestedById(studyId);
    const { data: baseStudy } = useGetBaseStudyInfoById(study?.base_study ?? undefined);
    const projectId = useProjectId();
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const replaceStudyWithNewClonedStudy = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetNonNestedById(studysetId);
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

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
        setConfirmationDialogState({
            isOpen: false,
            selectedVersion: undefined,
        });
    };

    const handleUpdateStudyset = async (versionToSwapTo: string) => {
        if (!studyset?.studies || !studyId || !studysetId) throw new Error('studyset not found');
        if (!studyset.studies.includes(studyId)) throw new Error('study not found in studyset');
        if (!studyset.studyset_studies?.some((assoc) => assoc.id === studyId))
            throw new Error('study not found in studyset_studies');

        const studysetStudiesUpdate = [...(studyset.studyset_studies ?? [])]
            .filter((assoc) => !!assoc.id)
            .map((assoc) => ({
                id: assoc.id === studyId ? versionToSwapTo : assoc.id!,
                curation_stub_uuid: assoc.curation_stub_uuid ?? undefined,
            }));

        return updateStudyset({
            studysetId: studysetId,
            studyset: { studies: studysetStudiesUpdate },
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
        if (!studyId || !studysetId || !versionToSwapTo || !studyset?.studies) return;
        if (versionToSwapTo === studyId) {
            handleCloseNavMenu();
            return;
        }
        setIsSwapping(true);
        try {
            handleCloseNavMenu();

            // 1. Update the studyset
            await handleUpdateStudyset(versionToSwapTo);

            // 2. Update the studylist status
            replaceStudyWithNewClonedStudy(studyId, versionToSwapTo);
            updateExtractionTableStateStudySwapInStorage(projectId, studyId, versionToSwapTo);

            navigate(`/projects/${projectId}/extraction/studies/${versionToSwapTo}/edit`);

            enqueueSnackbar('Swapped study versions', { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error selecting another study version', {
                variant: 'error',
            });
        } finally {
            setIsSwapping(false);
        }
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
        const baseVersions = baseStudy?.versions ?? [];
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
                        {...buttonProps}
                    >
                        {isSwapping ? (
                            <ProgressLoader color="secondary" size={20} />
                        ) : (
                            <SwapHorizIcon sx={{ fontSize: '1.2rem' }} />
                        )}
                        {buttonLabel && <Typography {...buttonLabelProps}>{buttonLabel}</Typography>}
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
                onCloseDialog={handleCloseConfirmationDialog}
                isOpen={confirmationDialogState.isOpen}
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
                                        href={`/base-studies/${baseStudy?.id ?? ''}/${version.id}`}
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

export default EditStudySwapVersionButtonNext;
