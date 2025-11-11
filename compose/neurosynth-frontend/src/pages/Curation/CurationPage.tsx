import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import GlobalStyles from 'global.styles';
import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import CurationBoardBasic from 'pages/Curation/components/CurationBoardBasic';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useGetProjectIsLoading,
    useProjectCreatedAt,
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CurationBoardAI from './components/CurationBoardAi';
import CurationDownloadSummaryButton from './components/CurationDownloadSummaryButton';
import PrismaDialog from './components/PrismaDialog';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import { SnackbarKey, useSnackbar } from 'notistack';
import useCurationBoardGroupsState from './hooks/useCurationBoardGroupsState';

const localStorageNewUIKey = 'show-new-ui-may-30-2025';

const CurationPage: React.FC = () => {
    const navigate = useNavigate();
    const projectUser = useProjectUser();
    const studysetId = useProjectExtractionStudysetId();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const { included, uncategorized } = useGetCurationSummary();
    const columns = useProjectCurationColumns();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const projectIsLoading = useGetProjectIsLoading();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { groups, selectedGroup, handleSetSelectedGroup } = useCurationBoardGroupsState();

    const [prismaIsOpen, setPrismaIsOpen] = useState(false);

    const projectCreateDate = useProjectCreatedAt();
    const [useNewUI, setUseNewUI] = useState<boolean>();

    useEffect(() => {
        if (useNewUI === undefined) {
            const localStorageValue = localStorage.getItem(localStorageNewUIKey);
            if (projectCreateDate === undefined) return;
            if (!localStorageValue) {
                setUseNewUI(projectCreateDate >= new Date('2025-05-30')); // arbitrary date representing rollout of this feature
                return;
            }

            setUseNewUI(localStorageValue === 'true');
        }
    }, [projectCreateDate, useNewUI]);

    const isPrisma = useProjectCurationIsPrisma();
    const projectName = useProjectName();

    const extractionStepInitialized = studysetId && annotationId && (studyset?.studies?.length || 0) > 0;
    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    const handleNavigateToStep = (groupId: string, snackbarId: SnackbarKey) => {
        const foundGroup = groups.find((g) => g.id === groupId);
        if (foundGroup) {
            handleSetSelectedGroup(foundGroup);
        }
        closeSnackbar(snackbarId);
    };

    const handleMoveToExtractionPhase = () => {
        if (!canMoveToExtractionPhase) {
            const existingIssues: { phase: string; colId: string; numUncategorized: number }[] = [];
            for (let i = 0; i < columns.length - 1; i++) {
                // skip the last column as it is included
                const column = columns[i];
                const numUncategorized = column.stubStudies.filter((s) => s.exclusionTagId === null).length;
                if (numUncategorized > 0) {
                    existingIssues.push({ phase: column.name, colId: column.id, numUncategorized });
                }
            }

            const snackbarId = enqueueSnackbar(
                <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }} gutterBottom>
                        You must complete curation before moving to extraction
                    </Typography>
                    {existingIssues.map((issue) => (
                        <Typography key={issue.phase} variant="body2">
                            The <b>{issue.phase}</b> step still has <b>{issue.numUncategorized} studies</b> that need to
                            be either <b>included</b> or <b>excluded</b>.
                        </Typography>
                    ))}

                    <Box sx={{ marginTop: '1rem' }}>
                        {existingIssues.map((issue) => (
                            <Button
                                key={issue.phase}
                                sx={{ margin: '4px' }}
                                variant="contained"
                                color="primary"
                                disableElevation
                                size="small"
                                onClick={() => handleNavigateToStep(issue.colId, snackbarId)}
                            >
                                Go to {issue.phase}
                            </Button>
                        ))}
                    </Box>
                </Box>,
                { variant: 'warning', autoHideDuration: null }
            );
            return;
        } else if (extractionStepInitialized) {
            navigate(`/projects/${projectId}/extraction`);
        } else {
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const indicateGoToExtraction = !extractionStepInitialized && canMoveToExtractionPhase;

    return (
        <StateHandlerComponent isError={false} isLoading={projectIsLoading}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box
                    sx={{
                        display: 'flex',
                        marginBottom: '0.5rem',
                        justifyContent: 'space-between',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: projectName || '',
                                    link: `/projects/${projectId}`,
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Search & Curate',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <LoadingStateIndicatorProject />
                    </Box>
                    <Box>
                        <Tooltip
                            placement="bottom"
                            title={
                                <Box style={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2">
                                        Please note that the old curation phase UI will soon be removed and replaced
                                        with the new interface. If you have any feedback on the new interface, please
                                        let us know using the feedback button!
                                    </Typography>
                                </Box>
                            }
                        >
                            <FormControlLabel
                                control={<Switch size="small" checked={!!useNewUI} />}
                                label={useNewUI ? 'Switch to Old Interface' : 'Switch to New Interface'}
                                slotProps={{
                                    typography: { fontSize: '12px' },
                                }}
                                onChange={() => {
                                    localStorage.setItem(localStorageNewUIKey, `${!useNewUI}`);
                                    setUseNewUI((prev) => !prev);
                                }}
                            />
                        </Tooltip>
                        {!useNewUI && (
                            <Button
                                variant="contained"
                                disableElevation
                                sx={{ marginLeft: '0.5rem', fontSize: '12px' }}
                                onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                                disabled={!canEdit}
                                size="small"
                            >
                                import studies
                            </Button>
                        )}
                        {isPrisma && !useNewUI && (
                            <>
                                <PrismaDialog onCloseDialog={() => setPrismaIsOpen(false)} isOpen={prismaIsOpen} />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ marginLeft: '0.5rem', fontSize: '12px' }}
                                    startIcon={<ChangeHistoryIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        {!useNewUI && (
                            <CurationDownloadSummaryButton buttonGroupProps={{ sx: { marginLeft: '0.5rem' } }} />
                        )}
                        <Button
                            onClick={handleMoveToExtractionPhase}
                            variant={canMoveToExtractionPhase ? 'contained' : 'outlined'}
                            color="success"
                            size="small"
                            sx={{
                                ml: '0.5rem',
                                fontSize: '12px',
                                ...(indicateGoToExtraction
                                    ? { ...GlobalStyles.colorPulseAnimation, color: 'success.dark' }
                                    : {}),
                            }}
                            disableElevation
                            disabled={!canEdit}
                        >
                            {extractionStepInitialized ? 'view extraction' : 'start extraction'}
                        </Button>
                    </Box>
                </Box>
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                    {useNewUI ? (
                        <CurationBoardAI
                            groups={groups}
                            selectedGroup={selectedGroup}
                            handleSetSelectedGroup={handleSetSelectedGroup}
                        />
                    ) : (
                        <CurationBoardBasic />
                    )}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
