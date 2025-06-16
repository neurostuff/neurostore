import { Box, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ProjectCurationStepCard from './ProjectCurationStepCard';
import ProjectCurationStepChooseWorkflow from './ProjectCurationStepChooseWorkflow';
import ProjectComponentsStyles from 'pages/Project/components/Project.styles';
import useUpdateProject from 'hooks/projects/useUpdateProject';
import { useGetProjectById } from 'hooks';
import { initCurationHelper } from '../store/ProjectStore.helpers';
import { useQueryClient } from 'react-query';
import { AxiosResponse } from 'axios';
import { INeurosynthProject } from 'hooks/projects/useGetProjects';

export enum ECurationBoardTypes {
    PRISMA,
    SIMPLE,
    // CUSTOM,
    // SKIP,
}

interface ICurationStep {
    curationStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const ProjectCurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { projectId } = useParams<{ projectId: string }>();
    const { data } = useGetProjectById(projectId);
    const navigate = useNavigate();
    const { curationStepHasBeenInitialized, disabled, ...stepProps } = props;
    const { mutate, isLoading } = useUpdateProject();
    const queryClient = useQueryClient();

    const handleCreateCuration = (curationBoardInitColumns: string[], isPRISMA: boolean) => {
        if (!projectId || !data) return;

        const curationMetadata = initCurationHelper(curationBoardInitColumns, isPRISMA);
        const updatedProvenance = {
            ...data.provenance,
            curationMetadata: curationMetadata,
        };

        mutate(
            {
                projectId: projectId,
                project: {
                    provenance: updatedProvenance,
                },
            },
            {
                onSuccess: () => {
                    const data = queryClient.getQueryData<AxiosResponse<INeurosynthProject>>(['projects', projectId]);
                    if (!data) return;

                    queryClient.setQueryData(['projects', projectId], {
                        ...data,
                        data: {
                            ...data.data,
                            provenance: updatedProvenance,
                        },
                    });

                    navigate(`/projects/${projectId}/curation`);
                },
            }
        );
    };

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Search & Curate</b>: Import, exclude, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>The first step in creating a meta-analysis</b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, import studies from PubMed, tag studies, and either exclude or include studies
                        into your meta-analysis
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {curationStepHasBeenInitialized ? (
                            <ProjectCurationStepCard disabled={disabled} projectId={projectId} />
                        ) : (
                            <ProjectCurationStepChooseWorkflow
                                disabled={disabled}
                                isLoading={isLoading}
                                onCreateCuration={handleCreateCuration}
                            />
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ProjectCurationStep;
