import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button, Tooltip } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import GlobalStyles from 'global.styles';
import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import CurationBoardBasic from 'pages/Curation/components/CurationBoardBasic';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CurationBoardAI from './components/CurationBoardAi';
import PrismaDialog from './components/PrismaDialog';

const CurationPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();

    const projectUser = useProjectUser();
    const studysetId = useProjectExtractionStudysetId();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const { included, uncategorized } = useGetCurationSummary();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);

    const [prismaIsOpen, setPrismaIsOpen] = useState(false);

    useInitProjectStoreIfRequired();

    const isPrisma = useProjectCurationIsPrisma();
    const projectName = useProjectName();

    const extractionStepInitialized = studysetId && annotationId && (studyset?.studies?.length || 0) > 0;
    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    const handleMoveToExtractionPhase = () => {
        if (extractionStepInitialized) {
            navigate(`/projects/${projectId}/extraction`);
        } else {
            navigate(`/projects/${projectId}`, {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', marginBottom: '0.5rem', justifyContent: 'space-between' }}>
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
                        {isPrisma && (
                            <>
                                <PrismaDialog onCloseDialog={() => setPrismaIsOpen(false)} isOpen={prismaIsOpen} />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    sx={{ marginLeft: '0.5rem', width: '180px' }}
                                    startIcon={<ChangeHistoryIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        {!extractionStepInitialized && (
                            <Tooltip
                                title="Click this button to skip curation and automatically include all studies"
                                placement="top"
                            >
                                <>
                                    <Button
                                        color="success"
                                        variant="outlined"
                                        size="small"
                                        disabled={uncategorized === 0}
                                    >
                                        skip curation
                                    </Button>
                                </>
                            </Tooltip>
                        )}
                        <Button
                            onClick={handleMoveToExtractionPhase}
                            variant="contained"
                            color="success"
                            size="small"
                            sx={{
                                width: '180px',
                                ml: '0.5rem',
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
                    {isPrisma ? <CurationBoardBasic /> : <CurationBoardAI />}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
