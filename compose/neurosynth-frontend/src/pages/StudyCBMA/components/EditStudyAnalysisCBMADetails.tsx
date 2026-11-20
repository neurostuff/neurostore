import { Box, TextField, Typography } from '@mui/material';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import { useAddOrUpdateAnalysis, useStudyAnalysisDescription, useStudyAnalysisName } from 'stores/study/StudyStore';
import EditStudyAnalysisCBMADeleteButton from './EditStudyAnalysisCBMADeleteButton';

const EditStudyAnalysisCBMADetails = (props: { analysisId?: string; onDeleteAnalysis: () => void }) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const { studyAnnotationsTableRef } = useStudyCBMAContext();
    const name = useStudyAnalysisName(props.analysisId);
    const description = useStudyAnalysisDescription(props.analysisId);

    const handleUpdateAnalysisDetails = (field: 'name' | 'description', analysisId: string, value: string) => {
        if (!analysisId) return;
        addOrUpdateAnalysis({
            id: analysisId,
            [field]: value,
        });
        studyAnnotationsTableRef.current?.updateAnalysisDetails(analysisId, field, value);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>Analysis Details</Typography>
                <EditStudyAnalysisCBMADeleteButton
                    variant="contained"
                    disableElevation
                    color="error"
                    size="small"
                    onDeleteAnalysis={props.onDeleteAnalysis}
                    analysisId={props.analysisId}
                >
                    Delete Analysis
                </EditStudyAnalysisCBMADeleteButton>
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

export default EditStudyAnalysisCBMADetails;
