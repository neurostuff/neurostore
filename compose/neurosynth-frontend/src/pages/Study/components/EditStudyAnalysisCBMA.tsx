import { Box, Typography } from '@mui/material';
import EditStudyAnalysisCBMADetails from 'pages/Study/components/EditStudyAnalysisCBMADetails';
import EditStudyAnalysisCBMAPoints from 'pages/Study/components/EditStudyAnalysisCBMAPoints';
import StudyAnalysisWarnings from 'pages/Study/components/StudyAnalysisWarnings';

const EditStudyAnalysisCBMA: React.FC<{
    analysisId?: string;
    onDeleteAnalysis: () => void;
}> = (props) => {
    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    return (
        <Box sx={{ marginBottom: '2rem' }}>
            <StudyAnalysisWarnings analysisId={props.analysisId} />
            <EditStudyAnalysisCBMADetails analysisId={props.analysisId} onDeleteAnalysis={props.onDeleteAnalysis} />
            <EditStudyAnalysisCBMAPoints analysisId={props.analysisId} />
            {/* TODO: This can be added back later when we have a better understanding of where it fits in as currently, all meta-analysis algorithms do not use this */}
            {/* <Box sx={{ marginTop: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Conditions
                </Typography>
                <EditAnalysisConditions analysisId={props.analysisId} />
            </Box> */}
        </Box>
    );
};

export default EditStudyAnalysisCBMA;
