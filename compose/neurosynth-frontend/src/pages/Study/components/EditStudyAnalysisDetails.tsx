import { Box, TextField, Typography } from '@mui/material';
import {
    useAddOrUpdateAnalysis,
    useStudyAnalysisDescription,
    useStudyAnalysisName,
} from 'pages/Study/store/StudyStore';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';
import EditStudyAnalysisDeleteButton from './EditStudyAnalysisDeleteButton';
import { useUpdateAnnotationNoteDetails } from 'stores/AnnotationStore.actions';

const EditStudyAnalysisDetails: React.FC<{ analysisId?: string; onDeleteAnalysis: () => void }> = (props) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const name = useStudyAnalysisName(props.analysisId);
    const description = useStudyAnalysisDescription(props.analysisId);
    const updateAnnotationNoteName = useUpdateAnnotationNoteDetails();

    const handleUpdateAnalysisDetails = (field: keyof IStoreAnalysis, analysisId: string, value: string) => {
        if (!analysisId) return;
        addOrUpdateAnalysis({
            id: analysisId,
            [field]: value,
        });
        if (field === 'name') {
            updateAnnotationNoteName({
                analysis: analysisId,
                analysis_name: value,
            });
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>Analysis Details</Typography>
                <EditStudyAnalysisDeleteButton
                    variant="contained"
                    disableElevation
                    color="error"
                    size="small"
                    onDeleteAnalysis={props.onDeleteAnalysis}
                    analysisId={props.analysisId}
                >
                    Delete Analysis
                </EditStudyAnalysisDeleteButton>
            </Box>
            <TextField
                label="name"
                size="small"
                sx={{ width: '100%', marginBottom: '1rem' }}
                value={name || ''}
                onChange={(event) => {
                    handleUpdateAnalysisDetails('name', props.analysisId || '', event.target.value);
                }}
            />
            <TextField
                onChange={(event) => {
                    handleUpdateAnalysisDetails('description', props.analysisId || '', event.target.value);
                }}
                label="description"
                size="small"
                sx={{ width: '100%' }}
                value={description || ''}
            />
        </Box>
    );
};

export default EditStudyAnalysisDetails;
