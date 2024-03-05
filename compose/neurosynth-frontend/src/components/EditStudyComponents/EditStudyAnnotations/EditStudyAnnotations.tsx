import { Box, Typography } from '@mui/material';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import EditStudyAnnotationsHotTable from 'components/HotTables/EditStudyAnnotationsHotTable/EditStudyAnnotationsHotTable';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useNumStudyAnalyses } from 'pages/Studies/StudyStore';

const EditStudyAnnotations: React.FC = (props) => {
    const numAnalyses = useNumStudyAnalyses();
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
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>
                    Study Annotations
                </Typography>
            }
        >
            <Box sx={{ padding: '1rem 0' }}>
                {numAnalyses === 0 ? (
                    <Typography sx={{ color: 'warning.dark' }}>
                        There are no annotations for this study. To get started, add an analysis
                        below
                    </Typography>
                ) : (
                    <EditStudyAnnotationsHotTable />
                )}
            </Box>
        </NeurosynthAccordion>
    );
};

export default EditStudyAnnotations;
