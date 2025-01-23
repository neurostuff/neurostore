import { Box, Button, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';
import EditSpecificationDialog from './EditSpecificationDialog';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import RunMetaAnalysisInstructions from './RunMetaAnalysisInstructions';

function NoMetaAnalysisResultDisplay() {
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);
    const [editSpecificationDialogIsOpen, setEditSpecificationDialogIsOpen] = useState(false);

    return (
        <>
            <MetaAnalysisResultStatusAlert metaAnalysis={metaAnalysis} metaAnalysisResult={undefined} />
            <NeurosynthAccordion
                elevation={0}
                expandIconColor={editsAllowed ? 'secondary.main' : 'primary.main'}
                sx={{
                    marginTop: '1rem',
                    border: '2px solid',
                    borderColor: editsAllowed ? 'secondary.main' : 'primary.main',
                }}
                accordionSummarySx={{
                    ':hover': {
                        backgroundColor: '#f2f2f2',
                    },
                }}
                TitleElement={
                    <Typography
                        sx={{
                            color: editsAllowed ? 'secondary.main' : 'primary.main',
                        }}
                    >
                        {editsAllowed ? 'View/Edit' : 'View'} Meta-Analysis Specification
                    </Typography>
                }
            >
                <Box>
                    <EditSpecificationDialog
                        isOpen={editSpecificationDialogIsOpen}
                        onCloseDialog={() => setEditSpecificationDialogIsOpen(false)}
                    />
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditSpecificationDialogIsOpen(true);
                        }}
                        color="secondary"
                        variant="contained"
                        size="small"
                        sx={{ marginBottom: '1rem' }}
                        disableElevation
                        disabled={!editsAllowed}
                    >
                        Edit Specification
                    </Button>
                </Box>
                <DisplayMetaAnalysisSpecification metaAnalysisId={metaAnalysisId || ''} projectId={projectId || ''} />
            </NeurosynthAccordion>
            <Box sx={{ marginTop: '1rem' }}>
                <RunMetaAnalysisInstructions metaAnalysisId={metaAnalysisId || ''} />
            </Box>
        </>
    );
}

export default NoMetaAnalysisResultDisplay;
