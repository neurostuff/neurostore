import { Box, Typography } from '@mui/material';
import EditStudyAnalysisCBMADetails from 'pages/StudyCBMA/components/EditStudyAnalysisCBMADetails';
import EditStudyAnalysisCBMAPoints from 'pages/StudyCBMA/components/EditStudyAnalysisCBMAPoints';
import StudyAnalysisWarnings from 'pages/Study/components/StudyAnalysisWarnings';

const EditStudyAnalysisCBMA = (props: { analysisId?: string; onDeleteAnalysis: () => void }) => {
    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    return (
        <Box sx={{ marginBottom: '2rem' }}>
            <StudyAnalysisWarnings analysisId={props.analysisId} />
            <EditStudyAnalysisCBMADetails analysisId={props.analysisId} onDeleteAnalysis={props.onDeleteAnalysis} />
            <EditStudyAnalysisCBMAPoints analysisId={props.analysisId} />
        </Box>
    );
};

export default EditStudyAnalysisCBMA;
