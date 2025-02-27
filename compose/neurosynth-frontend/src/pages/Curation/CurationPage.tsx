import SchemaIcon from '@mui/icons-material/Schema';
import { Box, Button } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import GlobalStyles from 'global.styles';
import { useGetCurationSummary, useGetStudysetById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import CurationBoard from 'pages/Curation/components/CurationBoard';
import PrismaDialog from 'pages/Curation/components/PrismaDialog';
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
import CurationDownloadIncludedStudiesButton from './components/CurationDownloadIncludedStudiesButton';

const CurationPage: React.FC = () => {
    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    useInitProjectStoreIfRequired();

    const navigate = useNavigate();

    const isPrisma = useProjectCurationIsPrisma();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const projectName = useProjectName();
    const { included, uncategorized } = useGetCurationSummary();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);

    const extractionStepInitialized = studysetId && annotationId && (studyset?.studies?.length || 0) > 0;

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

    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    return (
        <StateHandlerComponent isError={false} isLoading={false}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box
                    sx={{
                        display: 'flex',
                        marginBottom: '1rem',
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
                    <Box sx={{ marginRight: '1rem' }}>
                        <CurationDownloadIncludedStudiesButton />
                        {isPrisma && (
                            <>
                                <PrismaDialog onCloseDialog={() => setPrismaIsOpen(false)} isOpen={prismaIsOpen} />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    sx={{ marginLeft: '0.5rem', width: '180px' }}
                                    startIcon={<SchemaIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        <Button
                            variant="contained"
                            disableElevation
                            sx={{ marginLeft: '0.5rem', width: '180px' }}
                            onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                            disabled={!canEdit}
                        >
                            import studies
                        </Button>
                        {canMoveToExtractionPhase && (
                            <Button
                                onClick={handleMoveToExtractionPhase}
                                variant="contained"
                                color="success"
                                sx={{
                                    width: '180px',
                                    ml: '0.5rem',
                                    ...(extractionStepInitialized
                                        ? { color: 'white' }
                                        : {
                                              ...GlobalStyles.colorPulseAnimation,
                                              color: 'success.dark',
                                          }),
                                }}
                                disableElevation
                                disabled={!canEdit}
                            >
                                {extractionStepInitialized ? 'view extraction' : 'go to extraction'}
                            </Button>
                        )}
                    </Box>
                </Box>
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                    <CurationBoard />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};
export default CurationPage;
