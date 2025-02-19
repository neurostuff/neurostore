import { Box, Button } from '@mui/material';
import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useNavigate, useParams } from 'react-router-dom';
import CurationDownloadIncludedStudiesButton from './CurationDownloadIncludedStudiesButton';
import GlobalStyles from 'global.styles';

const CurationBoardAIInterface: React.FC = () => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();

    const projectUser = useProjectUser();
    const studysetId = useProjectExtractionStudysetId();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const annotationId = useProjectExtractionAnnotationId();
    const { included, uncategorized } = useGetCurationSummary();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);

    const extractionStepInitialized = studysetId && annotationId && (studyset?.studies?.length || 0) > 0;

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

    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;

    return (
        <Box sx={{ marginRight: '1rem', padding: '0.5rem' }}>
            <Box>
                <Button
                    variant="contained"
                    disableElevation
                    sx={{ marginRight: '0.5rem', width: '180px' }}
                    onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                    disabled={!canEdit}
                    size="small"
                >
                    import studies
                </Button>
                <CurationDownloadIncludedStudiesButton />
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
            <Box></Box>
        </Box>
    );
};

export default CurationBoardAIInterface;
