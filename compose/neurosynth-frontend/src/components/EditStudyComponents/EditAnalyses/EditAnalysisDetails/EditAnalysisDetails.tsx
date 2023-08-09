import { Box, TextField } from '@mui/material';
import { useStudyAnalysisName, useStudyAnalysisDescription } from 'stores/StudyStore/getters';
import { IStoreAnalysis } from 'stores/StudyStore/models';
import { useAddOrUpdateAnalysis } from 'stores/StudyStore/setters';

const EditAnalysisDetails: React.FC<{ analysisId?: string }> = (props) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const name = useStudyAnalysisName(props.analysisId);
    const description = useStudyAnalysisDescription(props.analysisId);

    const handleUpdateAnalysisDetails = (
        field: keyof IStoreAnalysis,
        analysisId: string,
        value: string
    ) => {
        if (!analysisId) return;
        addOrUpdateAnalysis({
            id: analysisId,
            [field]: value,
        });
    };

    return (
        <Box sx={{ width: '100%' }}>
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
                    handleUpdateAnalysisDetails(
                        'description',
                        props.analysisId || '',
                        event.target.value
                    );
                }}
                label="description"
                size="small"
                sx={{ width: '100%' }}
                value={description || ''}
            />
        </Box>
    );
};

export default EditAnalysisDetails;
