import { Add } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysesByIds, useGuard } from 'hooks';
import {
    useProjectId,
    useProjectMetaAnalyses,
    useProjectMetaAnalysisCanEdit,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ProjectViewMetaAnalysis from 'pages/Project/components/ProjectViewMetaAnalysis';
import useUserCanEdit from 'hooks/useUserCanEdit';

const ProjectViewMetaAnalyses: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const projectMetaAnalyses = useProjectMetaAnalyses() || [];
    let metaAnalysisIds: string[] = [];
    if (projectMetaAnalyses.length > 0) {
        if (typeof projectMetaAnalyses[0] === 'string') {
            metaAnalysisIds = projectMetaAnalyses as string[];
        } else {
            metaAnalysisIds = (projectMetaAnalyses as MetaAnalysisReturn[])
                .map((metaAnalysis) => metaAnalysis.id)
                .filter((id): id is string => id !== undefined);
        }
    }
    const { data = [], isLoading, isError } = useGetMetaAnalysesByIds(metaAnalysisIds);
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();
    const projectIdFromProject = useProjectId();
    const [createMetaAnalysisDialogIsOpen, setCreateMetaAnalysisDialogIsOpen] = useState(false);

    useGuard(
        `/projects/${projectId}/project`,
        'You must finish the meta-analysis creation process to view this page',
        projectIdFromProject === undefined || projectId !== projectIdFromProject ? false : !canEditMetaAnalyses
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
                    disabled={!canEdit}
                >
                    Meta-Analysis Specification
                </Button>
                {data.length === 0 && (
                    <Typography sx={{ marginTop: '1rem' }} color="warning.dark">
                        No Meta-Analyses for this project. Get started by clicking the button above
                    </Typography>
                )}
            </Box>
            <Box sx={{ padding: '0.5rem 0', display: 'flex', flexWrap: 'wrap' }}>
                {data.map((metaAnalysis, index) => (
                    <ProjectViewMetaAnalysis key={metaAnalysis.id || index} {...metaAnalysis} />
                ))}
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectViewMetaAnalyses;
