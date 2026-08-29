import { Box, Button, Card, CardActions, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material';
import PrivacyToggle from 'components/PrivacyToggle';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { getLatestMetaAnalysisResultId, getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import useGetMetaAnalysisJobById from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobById';
import useGetMetaAnalysisJobsByMetaAnalysisId from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobsByMetaAnalysisId';
import { useProjectUser } from 'stores/projects/ProjectStore';
import { useNavigate } from 'react-router-dom';

const ProjectViewMetaAnalysis = (props: MetaAnalysisReturn) => {
    const { created_at, updated_at, results, name, description, id, project, public: isPublic, user } = props;
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const canEditPrivacy = useUserCanEdit(user || undefined);
    const { mutate: updateMetaAnalysisPublic, isPending: updatePublicIsLoading } = useUpdateMetaAnalysis();

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
    const latestResultId = getLatestMetaAnalysisResultId(props);
    const {
        data: metaAnalysisResult,
        isLoading: getMetaAnalysisResultIsLoading,
        isError: getMetaAnalysisResultIsError,
    } = useGetMetaAnalysisResultById(latestResultId);

    const navigate = useNavigate();

    const hasResults = (results?.length || 0) > 0;

    const formatTimestamp = (value: string) => {
        const date = new Date(value);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    };

    const handleUpdate = () => {
        if (!id || !project) return;

        navigate(`/projects/${project}/meta-analyses/${id}`);
    };

    const updatePublic = (nextIsPublic: boolean) => {
        if (!id) return;
        updateMetaAnalysisPublic({
            metaAnalysisId: id,
            metaAnalysis: {
                public: nextIsPublic,
            },
        });
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
                <Stack>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                            <StateHandlerComponent
                                isError={getMetaAnalysisResultIsError || metaAnalysisJobsIsError || latestJobIsError}
                                isLoading={
                                    getMetaAnalysisResultIsLoading || metaAnalysisJobsIsLoading || latestJobIsLoading
                                }
                                loaderSize={18}
                            >
                                <Tooltip title={resultStatus.description || resultStatus.statusText}>
                                    <Chip
                                        size="small"
                                        color={resultStatus.color}
                                        label={resultStatus.statusText}
                                        variant="outlined"
                                    />
                                </Tooltip>
                            </StateHandlerComponent>
                        </Box>
                        <PrivacyToggle
                            isPublic={isPublic ?? true}
                            canEdit={canEditPrivacy}
                            onChange={updatePublic}
                            isLoading={updatePublicIsLoading}
                            tooltipTitle="Toggle meta-analysis privacy"
                        />
                    </Stack>

                    <Typography
                        variant="h6"
                        className="line-clamp-1"
                        color={name ? undefined : 'warning.dark'}
                        sx={{ minWidth: 0, mt: 2 }}
                    >
                        {name || 'No name'}
                    </Typography>

                    <Typography variant="body2" color={description ? 'muted.main' : 'warning.dark'}>
                        {description || 'No description'}
                    </Typography>
                    <Stack spacing={0.25} sx={{ mt: 1.5 }}>
                        {updated_at && (
                            <Typography variant="caption" color="muted.main">
                                Updated {formatTimestamp(updated_at)}
                            </Typography>
                        )}
                        {created_at && (
                            <Typography variant="caption" color="muted.main">
                                Created {formatTimestamp(created_at)}
                            </Typography>
                        )}
                    </Stack>
                </Stack>
            </CardContent>
            <CardActions sx={{ p: 2 }}>
                <Button
                    color={hasResults || !canEdit ? 'primary' : 'secondary'}
                    disableElevation
                    size="small"
                    sx={{ minWidth: '120px' }}
                    variant="contained"
                    onClick={handleUpdate}
                >
                    {hasResults || !canEdit ? 'view' : 'view and edit'}
                </Button>
            </CardActions>
        </Card>
    );
};

export default ProjectViewMetaAnalysis;
