import { Add } from '@mui/icons-material';
import { Box, Button, Link, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysesByProjectId } from 'hooks';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ViewMetaAnalysis from './ViewMetaAnalysis';

const ViewMetaAnalyses: React.FC = () => {
    const { projectId }: { projectId: string } = useParams();
    const { data, isLoading, isError } = useGetMetaAnalysesByProjectId(projectId);
    const [createMetaAnalysisDialogIsOpen, setCreateMetaAnalysisDialogIsOpen] = useState(false);

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <CreateMetaAnalysisSpecificationDialogBase
                isOpen={createMetaAnalysisDialogIsOpen}
                onCloseDialog={() => setCreateMetaAnalysisDialogIsOpen(false)}
            />
            <Box sx={{ width: '100%', paddingLeft: '1%' }}>
                {(data || []).length === 0 ? (
                    <Typography color="warning.dark">
                        No Meta-Analyses for this project. Get started by{' '}
                        <Link
                            underline="hover"
                            sx={{ cursor: 'pointer' }}
                            onClick={() => setCreateMetaAnalysisDialogIsOpen(true)}
                        >
                            clicking here
                        </Link>
                    </Typography>
                ) : (
                    <Button
                        onClick={() => setCreateMetaAnalysisDialogIsOpen(true)}
                        variant="contained"
                        startIcon={<Add />}
                        disableElevation
                    >
                        Meta-Analysis Specification
                    </Button>
                )}
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
