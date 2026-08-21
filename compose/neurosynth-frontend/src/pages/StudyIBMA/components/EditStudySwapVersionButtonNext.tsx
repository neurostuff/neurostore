import { OpenInNew, SwapHoriz } from '@mui/icons-material';
import {
    Box,
    Button,
    ButtonProps,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
    TypographyProps,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import { getVersionTypeLabel, versionMatchesPreferredType } from 'helpers/Extraction.helpers';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import {
    useGetBaseStudyInfoById,
    useGetStudyNonNestedById,
    useGetStudysetNonNestedById,
    useUpdateStudyset,
} from 'hooks';
import annotationQueries from 'hooks/annotations/annotationQueries';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useSnackbar } from 'notistack';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import { SearchDataType } from 'pages/Study/Study.types';
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    useProjectAnalysisType,
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'stores/projects/ProjectStore';

const formatVersionDate = (dateValue: string | null | undefined): string | undefined => {
    if (!dateValue) return undefined;
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return undefined;
    return parsedDate.toLocaleString();
};

const getIncompatibleVersionTooltip = (
    projectAnalysisType: EAnalysisType | undefined,
    preferredType: SearchDataType.COORDINATE | SearchDataType.IMAGE
): string => {
    const projectLabel = projectAnalysisType === EAnalysisType.IBMA ? 'IBMA' : 'CBMA';
    const requiredTypeLabel = preferredType === SearchDataType.IMAGE ? 'image' : 'coordinate';
    return `This ${projectLabel} project only allows switching to ${requiredTypeLabel}-based versions`;
};

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
    const projectAnalysisType = useProjectAnalysisType();
    const preferredType = projectAnalysisType === EAnalysisType.IBMA ? SearchDataType.IMAGE : SearchDataType.COORDINATE;
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const replaceStudyWithNewClonedStudy = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetNonNestedById(studysetId);
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const annotationId = useProjectExtractionAnnotationId();

    const [isSwapping, setIsSwapping] = useState(false);
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        selectedVersion?: string;
    }>({
        isOpen: false,
        selectedVersion: undefined,
    });

    const baseStudyVersions = useMemo(() => {
        const baseVersions = baseStudy?.versions ?? [];
        return baseVersions.sort(lastUpdatedAtSortFn);
    }, [baseStudy?.versions]);

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

        const versionToSwap = baseStudyVersions.find((version) => version.id === versionToSwapTo);
        if (!versionMatchesPreferredType(versionToSwap, preferredType)) {
            enqueueSnackbar(getIncompatibleVersionTooltip(projectAnalysisType, preferredType), {
                variant: 'error',
            });
            return;
        }

        setIsSwapping(true);
        try {
            handleCloseNavMenu();

            // 1. Update the studyset. The studyset update updates the annotation too, so we need to invalidate the cache
            await handleUpdateStudyset(versionToSwapTo);
            await queryClient.invalidateQueries({ queryKey: annotationQueries.byId(annotationId).queryKey });

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

        const versionToSwap = baseStudyVersions.find((version) => version.id === versionId);
        if (!versionMatchesPreferredType(versionToSwap, preferredType)) {
            return;
        }

        setConfirmationDialogState({ isOpen: true, selectedVersion: versionId });
    };

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));
    const incompatibleTooltip = getIncompatibleVersionTooltip(projectAnalysisType, preferredType);

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
                        aria-label="Swap study version"
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
                            <SwapHoriz sx={{ fontSize: '1.2rem' }} />
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
            <Menu
                open={open}
                onClose={handleCloseNavMenu}
                anchorEl={anchorEl}
                slotProps={{
                    paper: {
                        sx: { minWidth: 300, maxWidth: 360 },
                    },
                }}
            >
                {baseStudyVersions.map((version) => {
                    const isCurrentlySelected = version.id === studyId;
                    const isCompatible = versionMatchesPreferredType(version, preferredType);
                    const username = version.username ? version.username : 'neurosynth';
                    const typeLabel = getVersionTypeLabel(version);
                    const lastUpdated =
                        formatVersionDate(version.updated_at) ?? formatVersionDate(version.created_at) ?? 'Unknown';

                    return (
                        <MenuItem
                            key={version.id}
                            selected={isCurrentlySelected}
                            aria-disabled={!isCompatible}
                            data-testid={version.id ? `swap-to-version-${version.id}` : undefined}
                            onClick={() => {
                                if (!isCompatible) return;
                                handleSwitchVersion(version.id);
                            }}
                            sx={{
                                py: 1,
                                pr: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                cursor: isCompatible ? 'pointer' : 'default',
                            }}
                        >
                            <Tooltip title={incompatibleTooltip} disableHoverListener={isCompatible}>
                                <Box
                                    sx={{
                                        minWidth: 0,
                                        flex: 1,
                                        opacity: isCompatible ? 1 : 0.38,
                                        color: isCompatible ? 'inherit' : 'text.disabled',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            justifyContent: 'space-between',
                                            gap: 1,
                                        }}
                                    >
                                        <Typography variant="body2" fontWeight={600} noWrap>
                                            {typeLabel}
                                        </Typography>
                                        {isCurrentlySelected && (
                                            <Typography
                                                variant="caption"
                                                color={isCompatible ? 'primary.main' : 'text.disabled'}
                                                sx={{ flexShrink: 0 }}
                                            >
                                                Current
                                            </Typography>
                                        )}
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        color={isCompatible ? 'text.secondary' : 'text.disabled'}
                                        display="block"
                                        noWrap
                                    >
                                        {username} · {lastUpdated}
                                    </Typography>
                                </Box>
                            </Tooltip>
                            <Tooltip title="View version">
                                <IconButton
                                    size="small"
                                    component="a"
                                    href={`/base-studies/${baseStudy?.id ?? ''}/${version.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="View version"
                                    onClick={(event) => event.stopPropagation()}
                                    sx={{ flexShrink: 0, opacity: 1, color: 'action.active' }}
                                >
                                    <OpenInNew fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
};

export default EditStudySwapVersionButtonNext;
