import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Paper, Skeleton } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import GlobalStyles from 'global.styles';
import { useGetExtractionSummary } from 'hooks';
import EditStudyPageHeader from 'pages/StudyCBMA/components/EditStudyPageHeader';
import EditStudySwapVersionButton from 'pages/StudyCBMA/components/EditStudySwapVersionButton';
import EditStudyDetailsDialogIBMA from 'pages/StudyIBMA/components/EditStudyDetailsDialogIBMA';
import EditStudyStatusCard from 'pages/StudyIBMA/components/EditStudyStatusCard';
import ExtractionStudiesPreviewer from 'pages/StudyIBMA/components/ExtractionStudiesPreviewer';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGetAnnotationIsLoading } from 'stores/annotation/AnnotationStore.getters';
import { useProjectMetaAnalysisCanEdit, useProjectName } from 'stores/projects/ProjectStore';
import { useGetStudyIsLoading, useInitStudyStoreIfRequired, useStudyId, useStudyName } from 'stores/study/StudyStore';
import EditStudyAnalysisIBMA from './components/EditStudyAnalysisIBMA';
import EditStudyToolbarNext from './components/EditStudyToolbarNext';
import StartMetaAnalysisButton from './components/StartMetaAnalysisButton';

const StudyIBMAPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    // study stuff
    const getStudyIsLoading = useGetStudyIsLoading();
    const studyStoreId = useStudyId();
    const getAnnotationIsLoading = useGetAnnotationIsLoading();
    const projectName = useProjectName();
    const studyName = useStudyName();
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();

    const [studyDetailsDialogOpen, setStudyDetailsDialogOpen] = useState(false);

    useInitStudyStoreIfRequired();

    const isExtractionComplete = useMemo(() => {
        return extractionSummary.completed === extractionSummary.total && extractionSummary.total > 0;
    }, [extractionSummary.completed, extractionSummary.total]);

    const isLoading = !studyStoreId || getStudyIsLoading || getAnnotationIsLoading;
    const indicateGoToMetaAnalysis = isExtractionComplete && !metaAnalysisStepInitialized;

    return (
        <Box sx={{ px: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                <NeurosynthBreadcrumbs
                    isLoading={isLoading}
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
                            text: 'Extraction',
                            link: `/projects/${projectId}/extraction`,
                            isCurrentPage: false,
                        },
                        {
                            text: studyName || '',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
                <LoadingStateIndicatorProject />
                <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                    <EditStudySwapVersionButton
                        buttonProps={{ variant: 'outlined', size: 'medium', sx: {} }}
                        buttonLabelProps={{ sx: { fontSize: '0.8rem', ml: 1 } }}
                        buttonLabel="Switch version"
                    />
                    <StartMetaAnalysisButton
                        sx={{
                            ml: 1,
                            ...(indicateGoToMetaAnalysis
                                ? { ...GlobalStyles.colorPulseAnimation, color: 'success.dark' }
                                : {}),
                        }}
                    />
                </Box>
            </Box>
            <Box sx={{ display: 'flex', width: '100%', gap: 4, height: 'calc(100vh - 160px)' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', gap: 4 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 4,
                        }}
                    >
                        {isLoading ? (
                            <Skeleton sx={{ flex: 1, transform: 'none', height: '185px' }} />
                        ) : (
                            <Paper
                                elevation={1}
                                sx={{
                                    flex: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    p: 2,
                                }}
                            >
                                <Box>
                                    <EditStudyPageHeader />
                                </Box>
                                <Box>
                                    <Button
                                        sx={{ whiteSpace: 'nowrap' }}
                                        size="small"
                                        variant="outlined"
                                        color="secondary"
                                        disableElevation
                                        onClick={() => setStudyDetailsDialogOpen(true)}
                                    >
                                        <EditIcon sx={{ fontSize: '1.2rem', mr: 1 }} />
                                        Study Details
                                    </Button>
                                    <EditStudyDetailsDialogIBMA
                                        isOpen={studyDetailsDialogOpen}
                                        onClose={() => setStudyDetailsDialogOpen(false)}
                                    />
                                </Box>
                            </Paper>
                        )}
                        {isLoading ? (
                            <Skeleton sx={{ transform: 'none', height: '185px', width: '165px' }} />
                        ) : (
                            <EditStudyStatusCard />
                        )}
                    </Box>
                    <Box>
                        <EditStudyAnalysisIBMA />
                    </Box>
                </Box>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 2 }}>
                    <ExtractionStudiesPreviewer />
                    <Paper sx={{ p: 2 }}>
                        <EditStudyToolbarNext />
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
};

export default StudyIBMAPage;
