import { Box, Paper, Skeleton, Typography } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import GlobalStyles from 'global.styles';
import { useGetAnnotationById, useGetExtractionSummary, useGetStudyNonNestedById } from 'hooks';
import EditStudyStatusCard from 'pages/StudyIBMA/components/EditStudyStatusCard';
import ExtractionStudiesPreviewer from 'pages/StudyIBMA/components/ExtractionStudiesPreviewer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    useProjectExtractionAnnotationId,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
} from 'stores/projects/ProjectStore';
import EditStudyAnalysisIBMA from './components/EditStudyAnalysisIBMA';
import EditStudyPageHeaderNext from './components/EditStudyPageHeaderNext';
import EditStudySwapVersionButtonNext from './components/EditStudySwapVersionButtonNext';
import EditStudyToolbarNext from './components/EditStudyToolbarNext';
import StartMetaAnalysisButton from './components/StartMetaAnalysisButton';

const StudyIBMAPage: React.FC = () => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    const annotationId = useProjectExtractionAnnotationId();
    const {
        data: study,
        isLoading: studyIsLoading,
        isError: studyIsError,
        error: studyError,
    } = useGetStudyNonNestedById(studyId);
    const {
        data,
        isLoading: getAnnotationIsLoading,
        isError: annotationIsError,
        error: annotationError,
    } = useGetAnnotationById(annotationId);

    const projectName = useProjectName();
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();

    const isExtractionComplete = useMemo(() => {
        return extractionSummary.completed === extractionSummary.total && extractionSummary.total > 0;
    }, [extractionSummary.completed, extractionSummary.total]);

    const isLoading = studyIsLoading || getAnnotationIsLoading;
    const indicateGoToMetaAnalysis = isExtractionComplete && !metaAnalysisStepInitialized;

    const [height, setHeight] = useState<number>(0);
    const divRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const rowHeight = divRef.current?.offsetHeight || 0;
        setHeight(rowHeight);
    }, [divRef.current?.offsetHeight, studyId]);

    if (studyIsError) {
        return (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography sx={{ color: 'error.main', p: 4 }} variant="h4">
                    {studyError?.status === 404 ? 'Study not found' : 'There was an error loading the study'}
                </Typography>
            </Box>
        );
    }

    if (annotationIsError) {
        return (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography sx={{ color: 'error.main' }} variant="h4">
                    {annotationError.status === 404
                        ? 'Annotation not found'
                        : 'There was an error loading the annotation'}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ mx: 4 }}>
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
                            text: study?.name || '',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
                <LoadingStateIndicatorProject />
                <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                    <EditStudySwapVersionButtonNext
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
            <Box sx={{ display: 'flex', width: '100%', gap: 4, height: `calc(100vh - 150px)` }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 4, minWidth: 0 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 4,
                        }}
                        ref={divRef}
                    >
                        {isLoading ? (
                            <Skeleton sx={{ flex: 1, transform: 'none', height: '170px' }} />
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
                                <EditStudyPageHeaderNext />
                            </Paper>
                        )}
                        {isLoading ? (
                            <Skeleton sx={{ transform: 'none', height: '185px', width: '165px' }} />
                        ) : (
                            <EditStudyStatusCard />
                        )}
                    </Box>
                    <Box
                        sx={{
                            minWidth: 0,
                            width: '100%',
                            height: '100%',
                            maxHeight: `calc(100vh - ${height}px - 182px)`,
                        }}
                    >
                        <EditStudyAnalysisIBMA />
                    </Box>
                </Box>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 2 }}>
                    <ExtractionStudiesPreviewer />
                    <Paper sx={{ p: 2, boxSizing: 'border-box' }}>
                        <EditStudyToolbarNext />
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
};

export default StudyIBMAPage;
