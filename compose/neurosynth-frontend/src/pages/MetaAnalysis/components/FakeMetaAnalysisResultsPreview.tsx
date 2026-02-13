import { Box, Typography } from '@mui/material';
import DisplayMetaAnalysisActivations from './DisplayMetaAnalysisActivations';

const FakeMetaAnalysisResultsPreview: React.FC = () => {
    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Fake Meta-Analysis Results Preview
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                This page previews the coordinates section and citation box using synthetic empty results data.
            </Typography>
            <DisplayMetaAnalysisActivations metaAnalysis={undefined} metaAnalysisResult={undefined} />
        </Box>
    );
};

export default FakeMetaAnalysisResultsPreview;
