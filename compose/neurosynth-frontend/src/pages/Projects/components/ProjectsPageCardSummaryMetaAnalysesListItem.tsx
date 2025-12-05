import { ListItem, ListItemButton, ListItemIcon, ListItemProps, ListItemText, Skeleton } from '@mui/material';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import useGetMetaAnalysisJobById from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobById';
import useGetMetaAnalysisJobsByMetaAnalysisId from 'pages/MetaAnalysis/hooks/useGetMetaAnalysisJobsByMetaAnalysisId';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const ProjectsPageCardSummaryMetaAnalysesListItem: React.FC<ListItemProps & { metaAnalysis: MetaAnalysisReturn }> = (
    props
) => {
    const { metaAnalysis, ...listItemProps } = props;

    const { data: metaAnalysisResult, isLoading: getMetaAnalysisResultIsLoading } = useGetMetaAnalysisResultById(
        metaAnalysis?.results && metaAnalysis.results.length
            ? (metaAnalysis.results[metaAnalysis.results.length - 1] as ResultReturn).id
            : undefined
    );

    const { data: metaAnalysisJobs, isLoading: metaAnalysisJobsIsLoading } = useGetMetaAnalysisJobsByMetaAnalysisId(
        metaAnalysis?.id
    );
    const jobs = metaAnalysisJobs ?? [];
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : undefined;
    const { data: latestMetaAnalysisJob, isLoading: latestJobIsLoading } = useGetMetaAnalysisJobById(latestJob?.job_id);

    const resultStatus = useMemo(() => {
        return getResultStatus(metaAnalysis, metaAnalysisResult, latestMetaAnalysisJob);
    }, [metaAnalysis, metaAnalysisResult, latestMetaAnalysisJob]);

    if (getMetaAnalysisResultIsLoading || metaAnalysisJobsIsLoading || latestJobIsLoading) {
        return (
            <ListItem {...listItemProps} divider disableGutters disablePadding>
                <ListItemButton>
                    <ListItemIcon>
                        <Skeleton width={40} height={40} variant="circular" />
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Skeleton
                                variant="rectangular"
                                width="100%"
                                height="1.5rem"
                                sx={{ marginBottom: '0.25rem' }}
                            />
                        }
                        secondary={<Skeleton variant="rectangular" width="100%" />}
                    />
                </ListItemButton>
            </ListItem>
        );
    }

    return (
        <ListItem divider disableGutters disablePadding {...listItemProps}>
            <ListItemButton
                sx={{
                    padding: '0px',
                    borderRadius: '4px',
                    transition: '200ms ease-in-out',
                    '&:hover': {
                        padding: '0px 16px',
                        transition: '200ms ease-in-out',
                    },
                }}
                component={Link}
                to={`/projects/${metaAnalysis.project}/meta-analyses/${metaAnalysis.id}`}
            >
                <ListItemText
                    sx={{ minHeight: '44px' }}
                    primary={metaAnalysis.name}
                    secondary={resultStatus.statusText}
                    secondaryTypographyProps={{ color: resultStatus.color + '.main' }}
                />
            </ListItemButton>
        </ListItem>
    );
};

export default ProjectsPageCardSummaryMetaAnalysesListItem;
