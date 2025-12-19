import { Alert, Box, Button, Card, CardActions, CardContent, Chip, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import useGetMetaAnalysisJobById from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobById';
import useGetMetaAnalysisJobsByMetaAnalysisId from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobsByMetaAnalysisId';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { useNavigate } from 'react-router-dom';

const ProjectViewMetaAnalysis: React.FC<MetaAnalysisReturn> = (props) => {
    const { created_at, results, name, description, id, project } = props;
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const {
        data: metaAnalysisJobs,
        isLoading: metaAnalysisJobsIsLoading,
        isError: metaAnalysisJobsIsError,
    } = useGetMetaAnalysisJobsByMetaAnalysisId(id, canEdit);
    const jobs = metaAnalysisJobs ?? [];
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : undefined;
    const {
        data: latestMetaAnalysisJob,
        isLoading: latestJobIsLoading,
        isError: latestJobIsError,
    } = useGetMetaAnalysisJobById(latestJob?.job_id, canEdit);
    const allResults = (props.results ?? []) as ResultReturn[];
    const latestResult = allResults.length > 0 ? allResults[allResults.length - 1] : undefined;
    const {
        data: metaAnalysisResult,
        isLoading: getMetaAnalysisResultIsLoading,
        isError: getMetaAnalysisResultIsError,
    } = useGetMetaAnalysisResultById(latestResult?.id);

    const navigate = useNavigate();

    const date = new Date(created_at || '');
    const isLocked = (results?.length || 0) > 0;

    const handleUpdate = () => {
        if (!id || !project) return;

        navigate(`/projects/${project}/meta-analyses/${id}`);
    };

    const resultStatus = getResultStatus(props, metaAnalysisResult, latestMetaAnalysisJob);

    return (
        <Card
            sx={{
                flex: '0 1',
                flexBasis: 'calc(94% / 3)',
                margin: '10px 1%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <CardContent>
                <StateHandlerComponent
                    isError={getMetaAnalysisResultIsError || metaAnalysisJobsIsError || latestJobIsError}
                    isLoading={getMetaAnalysisResultIsLoading || metaAnalysisJobsIsLoading || latestJobIsLoading}
                >
                    <Box>
                        <Alert
                            severity={resultStatus.severity}
                            color={resultStatus.color}
                            sx={{ padding: '2px 10px' }}
                            variant="standard"
                        >
                            {resultStatus.statusText}
                        </Alert>
                    </Box>

                    <Box sx={{ marginTop: '1rem' }}>
                        <Chip
                            sx={{ marginBottom: '0.5rem' }}
                            size="small"
                            label={`Created: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`}
                        />
                        <Typography variant="h6" gutterBottom>
                            {name || ''}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'muted.main', marginTop: '0.5rem' }}>
                            {description || ''}
                        </Typography>
                    </Box>
                </StateHandlerComponent>
            </CardContent>
            <CardActions>
                <Button sx={{ width: '100%' }} onClick={handleUpdate}>
                    {isLocked || !canEdit ? 'view' : 'view and edit'}
                </Button>
            </CardActions>
        </Card>
    );
};

export default ProjectViewMetaAnalysis;
