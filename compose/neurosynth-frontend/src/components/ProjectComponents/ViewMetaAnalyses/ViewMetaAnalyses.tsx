import { Add } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysesByProjectId, useGuard } from 'hooks';
import {
    useProjectId,
    useProjectMetaAnalysisCanEdit,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ViewMetaAnalysis from './ViewMetaAnalysis';

const ViewMetaAnalyses: React.FC = () => {
    const { projectId }: { projectId: string } = useParams();
    const { data, isLoading, isError } = useGetMetaAnalysesByProjectId(projectId);
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();
    const projectIdFromProject = useProjectId();
    const [createMetaAnalysisDialogIsOpen, setCreateMetaAnalysisDialogIsOpen] = useState(false);

    useGuard(
        `/projects/${projectId}/edit`,
        'you must finish the meta-analysis creation process to view this page',
        projectIdFromProject === undefined || projectId !== projectIdFromProject
            ? false
            : !canEditMetaAnalyses
    );

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <CreateMetaAnalysisSpecificationDialogBase
                isOpen={createMetaAnalysisDialogIsOpen}
                onCloseDialog={() => setCreateMetaAnalysisDialogIsOpen(false)}
            />
            <Box sx={{ width: '100%', paddingLeft: '1%' }}>
                <Button
                    onClick={() => setCreateMetaAnalysisDialogIsOpen(true)}
                    variant="contained"
                    startIcon={<Add />}
                    disableElevation
                >
                    Meta-Analysis Specification
                </Button>
                {(data || []).length === 0 && (
                    <Typography sx={{ marginTop: '1rem' }} color="warning.dark">
                        No Meta-Analyses for this project. Get started by clicking the button above
                    </Typography>
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
