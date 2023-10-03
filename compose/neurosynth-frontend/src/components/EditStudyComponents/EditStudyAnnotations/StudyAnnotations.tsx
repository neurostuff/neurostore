import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import { Box, Typography } from '@mui/material';
import { HotTable } from '@handsontable/react';

const StudyAnnotations: React.FC = (props) => {
    return (
        <NeurosynthAccordion
            elevation={0}
            expandIconColor="secondary.main"
            sx={[
                EditStudyComponentsStyles.accordion,
                { borderTop: '1px solid', borderColor: 'secondary.main' },
            ]}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>
                    Study Annotations
                </Typography>
            }
        >
            <Box sx={{ height: '200px', width: '100%' }}>
                <HotTable
                    height={200}
                    width="100%"
                    stretchH="all"
                    licenseKey="non-commercial-and-evaluation"
                />
            </Box>
        </NeurosynthAccordion>
    );
};

export default StudyAnnotations;
