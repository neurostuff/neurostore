import { Box, Button, Paper, useMediaQuery, useTheme } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import {
    useProjectExtractionAnnotationId,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
} from 'pages/Project/store/ProjectStore';
import EditStudyPageHeader from 'pages/StudyCBMA/components/EditStudyPageHeader';
import EditStudyStatusCard from 'pages/StudyIBMA/components/EditStudyStatusCard';
import EditStudyToolbar2 from 'pages/StudyIBMA/components/EditStudyToolbar2';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/annotation/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/annotation/AnnotationStore.getters';
import {
    useClearStudyStore,
    useGetStudyIsLoading,
    useInitStudyStore,
    useStudyId,
    useStudyName,
} from 'stores/study/StudyStore';
import EditStudyAnalysisIBMA from './components/EditStudyAnalysisIBMA';
import StartMetaAnalysisButton from './components/StartMetaAnalysisButton';
import { useGetExtractionSummary } from 'hooks';
import GlobalStyles from 'global.styles';

const StudyIBMAPage: React.FC = () => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();

    const navigate = useNavigate();
    const annotationId = useProjectExtractionAnnotationId();
    // study stuff
    const getStudyIsLoading = useGetStudyIsLoading();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();
    const studyStoreId = useStudyId();
    // annotation stuff
    const annotationStoreId = useAnnotationId();
    const clearAnnotationStore = useClearAnnotationStore();
    const initAnnotationStore = useInitAnnotationStore();
    const getAnnotationIsLoading = useGetAnnotationIsLoading();
    const projectName = useProjectName();
    const studyName = useStudyName();
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

    // instead of the useInitStudyStoreIfRequired hook we call these funcitons in a useEffect as
    // we want to clear and init the study store every time in case the user wants to refresh the page and cancel their edits
    useEffect(() => {
        clearStudyStore();
        clearAnnotationStore();
        initStudyStore(studyId);
        initAnnotationStore(annotationId);
    }, [annotationId, clearAnnotationStore, clearStudyStore, initAnnotationStore, initStudyStore, studyId]);

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleBackToExtraction = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogIsOpen(true);
            return;
        }

        navigate(`/projects/${projectId}/extraction`);
    };

    const handleCloseConfirmationDialog = (ok: boolean | undefined) => {
        setConfirmationDialogIsOpen(false);
        if (!ok) return;

        unsetUnloadHandler('study');
        unsetUnloadHandler('annotation');
        handleBackToExtraction();
    };

    const isExtractionComplete = useMemo(() => {
        return extractionSummary.completed === extractionSummary.total && extractionSummary.total > 0;
    }, [extractionSummary.completed, extractionSummary.total]);

    const indicateGoToMetaAnalysis = isExtractionComplete && !metaAnalysisStepInitialized;

    return (
        <StateHandlerComponent
            disableShrink={false}
            isError={false}
            isLoading={!studyStoreId || !annotationStoreId || getStudyIsLoading || getAnnotationIsLoading}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', mx: 4, my: 2 }}>
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
                <StartMetaAnalysisButton
                    sx={{
                        marginLeft: 'auto',
                        ...(indicateGoToMetaAnalysis
                            ? { ...GlobalStyles.colorPulseAnimation, color: 'success.dark' }
                            : {}),
                    }}
                />
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    gap: 4,
                    flexWrap: 'wrap',
                    mb: 2,
                    mx: 4,
                    my: 2,
                }}
            >
                <Paper sx={{ flex: 1, minWidth: 'min(100%, 18rem)', p: 2 }}>
                    <EditStudyPageHeader />
                </Paper>
                <EditStudyStatusCard />
            </Box>
            <Box sx={{ mx: 4, my: 2 }}>
                <EditStudyAnalysisIBMA />
            </Box>
        </StateHandlerComponent>
    );
};

export default StudyIBMAPage;
