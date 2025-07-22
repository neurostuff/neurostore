import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import GlobalStyles from 'global.styles';
import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import CurationBoardBasic from 'pages/Curation/components/CurationBoardBasic';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useClearProjectStore,
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectCreatedAt,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CurationBoardAI from './components/CurationBoardAi';
import PrismaDialog from './components/PrismaDialog';
import CurationDownloadSummaryButton from './components/CurationDownloadSummaryButton';

const localStorageNewUIKey = 'show-new-ui-may-30-2025';

const CurationPage: React.FC = () => {
    const navigate = useNavigate();
    const projectUser = useProjectUser();
    const studysetId = useProjectExtractionStudysetId();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const { included, uncategorized } = useGetCurationSummary();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const projectIsLoading = useGetProjectIsLoading();
    const clearProjectStore = useClearProjectStore();

    const [prismaIsOpen, setPrismaIsOpen] = useState(false);

    const projectCreateDate = useProjectCreatedAt();
    const [useNewUI, setUseNewUI] = useState<boolean>();

    useInitProjectStoreIfRequired();

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

    useEffect(() => {
        return () => {
            clearProjectStore();
        };
    }, [clearProjectStore]);

    const isPrisma = useProjectCurationIsPrisma();
    const projectName = useProjectName();

    const extractionStepInitialized = studysetId && annotationId && (studyset?.studies?.length || 0) > 0;
    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    const handleMoveToExtractionPhase = () => {
        if (extractionStepInitialized) {
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
                    <Box sx={{ display: 'flex' }}>
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
                        <ProjectIsLoadingText />
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
                            variant="contained"
                            color="success"
                            size="small"
                            sx={{
                                ml: '0.5rem',
                                fontSize: '12px',
                                ...(extractionStepInitialized || !canMoveToExtractionPhase
                                    ? { color: 'white' }
                                    : {
                                          ...GlobalStyles.colorPulseAnimation,
                                          color: 'success.dark',
                                      }),
                            }}
                            disableElevation
                            disabled={!canEdit || !canMoveToExtractionPhase}
                        >
                            {extractionStepInitialized ? 'view extraction' : 'go to extraction'}
                        </Button>
                    </Box>
                </Box>
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                    {useNewUI ? <CurationBoardAI /> : <CurationBoardBasic />}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
