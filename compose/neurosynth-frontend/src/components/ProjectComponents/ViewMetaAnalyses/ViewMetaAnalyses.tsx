import { Add } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalyses } from 'hooks';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ViewMetaAnalysis from './ViewMetaAnalysis';

const ViewMetaAnalyses: React.FC = () => {
    const { projectId }: { projectId: string } = useParams();
    const { data, isLoading, isError } = useGetMetaAnalyses(projectId);
    const [createMetaAnalysisDialogIsOpen, setCreateMetaAnalysisDialogIsOpen] = useState(false);

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <CreateMetaAnalysisSpecificationDialogBase
                isOpen={createMetaAnalysisDialogIsOpen}
                onCloseDialog={() => setCreateMetaAnalysisDialogIsOpen(false)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                    {(data || []).length === 0 && (
                        <Typography color="warning.dark">
                            No Meta-Analyses for this project. Create one using the button on the
                            right.
                        </Typography>
                    )}
                </Box>
                <Box sx={{ marginRight: '1%' }}>
                    <Button
                        onClick={() => setCreateMetaAnalysisDialogIsOpen(true)}
                        sx={{ marginBottom: '1rem' }}
                        variant="contained"
                        startIcon={<Add />}
                        disableElevation
                    >
                        Meta-Analysis Specification
                    </Button>
                </Box>
            </Box>
            <Box sx={{ padding: '0.5rem 0', display: 'flex', flexWrap: 'wrap' }}>
                {(data || []).map((metaAnalysis, index) => (
                    <ViewMetaAnalysis key={metaAnalysis.id || index} {...metaAnalysis} />
                ))}
            </Box>
        </StateHandlerComponent>
    );
};

export default ViewMetaAnalyses;
