import { Box, Button, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyComponentsStyles from './EditStudyComponents.styles';
import { useStudyAnalyses } from '../store/StudyStore';
import { Add } from '@mui/icons-material';
import EditStudyAnalysisIBMA from './EditStudyAnalysisIBMA';

const EditStudyAnalysesIBMA: React.FC = () => {
    const analyses = useStudyAnalyses();

    const handleCreateNewAnalysis = () => {
        console.log('create new analysis');
    };

    return (
        <NeurosynthAccordion
            elevation={0}
            defaultExpanded
            expandIconColor="secondary.main"
            sx={[
                EditStudyComponentsStyles.accordion,
                {
                    borderTop: '2px solid',
                    borderColor: 'secondary.main',
                    borderTopLeftRadius: '4px !important',
                    borderTopRightRadius: '4px !important',
                },
            ]}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={<Typography sx={EditStudyComponentsStyles.accordionTitle}>Analyses</Typography>}
        >
            <Box sx={{ padding: '0.5rem 0' }}>
                {analyses.length === 0 && (
                    <Typography sx={{ color: 'warning.dark' }} gutterBottom>
                        There are no analyses for this study.
                    </Typography>
                )}
                <Box>
                    <EditStudyAnalysisIBMA />
                </Box>
            </Box>
        </NeurosynthAccordion>
    );
};

export default EditStudyAnalysesIBMA;
