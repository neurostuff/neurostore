import { Box, Typography } from '@mui/material';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import EditStudyAnnotationsHotTable from 'components/HotTables/EditStudyAnnotationsHotTable/EditStudyAnnotationsHotTable';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useAnnotationIsError, useAnnotationIsLoading } from 'stores/AnnotationStore.getters';

const EditStudyAnnotations: React.FC = (props) => {
    const analyses = useStudyAnalyses();
    const isLoading = useAnnotationIsLoading();
    const isError = useAnnotationIsError();

    return (
        <NeurosynthAccordion
            elevation={0}
            defaultExpanded
            expandIconColor="secondary.main"
            sx={EditStudyComponentsStyles.accordion}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>
                    Study Annotations
                </Typography>
            }
        >
            <Box sx={{ padding: '1rem 0' }}>
                {analyses.length === 0 ? (
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
