import { Box, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useStudyAnalyses } from 'stores/study/StudyStore';
import EditStudyAnalysisIBMA1 from './EditStudyAnalysisIBMA1';
import EditStudyComponentsStyles from 'pages/StudyCBMA/components/EditStudyComponents.styles';

const EditStudyIBMA: React.FC = () => {
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
                    <EditStudyAnalysisIBMA1 />
                </Box>
            </Box>
        </NeurosynthAccordion>
    );
};

export default EditStudyIBMA;
