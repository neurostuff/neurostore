import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
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
    usePromoteAllUncategorized,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CurationBoardAI from './components/CurationBoardAi';
import PrismaDialog from './components/PrismaDialog';

const CurationPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();

    const [skipCurationDialogIsOpen, setSkipCurationDialogIsOpen] = useState(false);

    const projectUser = useProjectUser();
    const studysetId = useProjectExtractionStudysetId();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const { included, uncategorized } = useGetCurationSummary();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);
    const promoteAllUncategorized = usePromoteAllUncategorized();

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
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const handleSkipCuration = (confirm?: boolean) => {
        if (confirm) {
            promoteAllUncategorized();
        }

        setSkipCurationDialogIsOpen(false);
    };

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
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
                        {isPrisma && (
                            <>
                                <PrismaDialog onCloseDialog={() => setPrismaIsOpen(false)} isOpen={prismaIsOpen} />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ marginLeft: '0.5rem' }}
                                    startIcon={<ChangeHistoryIcon />}
                                >
                                    PRISMA diagram
                                </Button>
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
                            </>
                        )}
                        {!extractionStepInitialized && (
                            <>
                                <ConfirmationDialog
                                    isOpen={skipCurationDialogIsOpen}
                                    onCloseDialog={handleSkipCuration}
                                    dialogTitle="Are you sure you want to skip curation?"
                                    rejectText="Cancel"
                                    confirmText="Continue"
                                    dialogMessage="All studies that have not been explicitly excluded will be included"
                                />
                                <Button
                                    sx={{ ml: '0.5rem' }}
                                    onClick={() => setSkipCurationDialogIsOpen(true)}
                                    color="info"
                                    variant="outlined"
                                    size="small"
                                    disabled={uncategorized === 0}
                                >
                                    skip curation
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={handleMoveToExtractionPhase}
                            variant="contained"
                            color="success"
                            size="small"
                            sx={{
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
