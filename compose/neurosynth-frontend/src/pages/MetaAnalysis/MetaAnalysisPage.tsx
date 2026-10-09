import { Lock, Public } from '@mui/icons-material';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { getLatestMetaAnalysisResultId } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisById, useGetMetaAnalysisResultById } from 'hooks';
import MetaAnalysisPageStyles from 'pages/MetaAnalysis/MetaAnalysisPage.styles';
import { useProjectIsPublic, useProjectName, useInitProjectStoreIfRequired } from 'stores/projects/ProjectStore';
import { Link, useParams } from 'react-router-dom';
import MetaAnalysisDetails from './components/MetaAnalysisDetails';
import { tagNamesFromMetaAnalysis } from './components/MetaAnalysisSettingsForm';
import MetaAnalysisStatusChip from './components/MetaAnalysisStatusChip';

const formatMetaAnalysisTimestamp = (value?: string | null) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
};

const MetaAnalysisPage = () => {
    // const { startTour } = useGetTour('MetaAnalysisPage');
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const {
        data: metaAnalysis,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);
    useInitProjectStoreIfRequired(projectId || metaAnalysis?.project || undefined);

    const projectName = useProjectName();
    const projectIsPublic = useProjectIsPublic();
    const latestResultId = getLatestMetaAnalysisResultId(metaAnalysis);
    const { isLoading: getMetaAnalysisResultIsLoading } = useGetMetaAnalysisResultById(latestResultId);

    const resolvedProjectId = projectId || metaAnalysis?.project || undefined;
    const isProjectRoute = Boolean(projectId);
    const breadcrumbItems = isProjectRoute
        ? [
              {
                  link: '/projects',
                  text: 'Projects',
                  isCurrentPage: false,
              },
              {
                  link: `/projects/${resolvedProjectId}/meta-analyses`,
                  text: projectName || '',
                  isCurrentPage: false,
              },
              {
                  link: '',
                  text: metaAnalysis?.name || '',
                  isCurrentPage: true,
              },
          ]
        : [
              {
                  link: '/meta-analyses',
                  text: 'Meta-Analyses',
                  isCurrentPage: false,
              },
              {
                  link: '',
                  text: metaAnalysis?.name || '',
                  isCurrentPage: true,
              },
          ];

    const isPublic = metaAnalysis?.public ?? true;
    const createdAtLabel = formatMetaAnalysisTimestamp(metaAnalysis?.created_at);
    const updatedAtLabel = formatMetaAnalysisTimestamp(metaAnalysis?.updated_at);
    const tagNames = tagNamesFromMetaAnalysis(metaAnalysis?.tags);

    return (
        <>
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading || getMetaAnalysisResultIsLoading}
                isError={getMetaAnalysisIsError}
                errorMessage="There was an error getting your meta-analysis"
            >
                {!isProjectRoute && projectIsPublic && resolvedProjectId && (
                    <Tooltip title="View the project that generated this meta-analysis" placement="top">
                        <Button
                            component={Link}
                            sx={{ mb: 1 }}
                            variant="contained"
                            disableElevation
                            to={`/projects/${resolvedProjectId}`}
                            size="small"
                        >
                            View project
                        </Button>
                    </Tooltip>
                )}
                <Box sx={{ marginBottom: '0.5rem' }}>
                    <NeurosynthBreadcrumbs breadcrumbItems={breadcrumbItems} />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem', mt: 1 }}>
                    <Typography sx={!metaAnalysis?.name ? MetaAnalysisPageStyles.noData : undefined} variant="h5">
                        {metaAnalysis?.name || 'No name'}
                    </Typography>
                    <Typography
                        sx={[
                            MetaAnalysisPageStyles.description,
                            !metaAnalysis?.description ? MetaAnalysisPageStyles.noData : {},
                        ]}
                    >
                        {metaAnalysis?.description || 'No description'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        {metaAnalysis?.username && (
                            <Chip
                                variant="outlined"
                                size="small"
                                label={`Owner: ${metaAnalysis.username}`}
                                color="primary"
                            />
                        )}
                        <Chip
                            variant="outlined"
                            size="small"
                            icon={isPublic ? <Public /> : <Lock />}
                            label={isPublic ? 'Public' : 'Private'}
                        />
                        {createdAtLabel && (
                            <Chip variant="outlined" size="small" label={`Created: ${createdAtLabel}`} />
                        )}
                        {updatedAtLabel && (
                            <Chip variant="outlined" size="small" label={`Last updated: ${updatedAtLabel}`} />
                        )}
                        <MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />
                    </Stack>
                    {tagNames.length > 0 && (
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                            {tagNames.map((tag) => (
                                <Chip
                                    key={tag}
                                    size="small"
                                    label={tag}
                                    sx={{ borderRadius: '4px', bgcolor: 'grey.100', color: 'text.secondary' }}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>

                <MetaAnalysisDetails />
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;
