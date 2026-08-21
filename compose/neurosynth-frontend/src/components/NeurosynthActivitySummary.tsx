import { Article, Hub, Psychology, ScatterPlot } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useGetMetaAnalysesPublic } from 'hooks';
import analysisQueries from 'hooks/analyses/analysisQueries';
import useGetPoints from 'hooks/analyses/useGetPoints';
import useGetDebouncedBaseStudiesFlat from 'hooks/studies/useGetDebouncedBaseStudiesFlat';

const NeurosynthActivitySummary = () => {
    const { data: studies, isLoading: getStudiesIsLoading } = useGetDebouncedBaseStudiesFlat({});
    const { data: points, isLoading: getPointsIsLoading } = useGetPoints();
    const { data: images, isLoading: getImagesIsLoading } = useQuery({ ...analysisQueries.images.every() });
    const { data: metaAnalyses, isLoading: getMetaAnalysesIsLoading } = useGetMetaAnalysesPublic();

    const stats = [
        {
            isLoading: getPointsIsLoading,
            value: points?.metadata?.total_count || 0,
            label: 'coordinates',
            Icon: ScatterPlot,
        },
        { isLoading: getImagesIsLoading, value: images?.metadata?.total_count || 0, label: 'images', Icon: Psychology },
        { isLoading: getStudiesIsLoading, value: studies?.metadata?.total_count || 0, label: 'studies', Icon: Article },
        {
            isLoading: getMetaAnalysesIsLoading,
            value: metaAnalyses?.metadata?.total_count || 0,
            label: 'public meta-analyses',
            Icon: Hub,
        },
    ];

    return (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
            {stats.map((stat) => (
                <Box key={stat.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <stat.Icon sx={{ fontSize: '4.5rem', color: 'primary.contrastText' }} />
                    <Box>
                        <Typography variant="h5" sx={{ color: 'primary.contrastText' }}>
                            {stat.label}
                        </Typography>
                        <Typography variant="h2" sx={{ color: 'primary.contrastText' }}>
                            {stat.value.toLocaleString()}
                        </Typography>
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default NeurosynthActivitySummary;
