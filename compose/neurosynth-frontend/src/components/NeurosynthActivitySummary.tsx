import { Box, Skeleton, Typography } from '@mui/material';
import { useGetBaseStudies } from 'hooks';
import useGetPoints from 'hooks/analyses/useGetPoints';

const NeurosynthActivitySummary: React.FC = () => {
    const { data: studies, isLoading: getStudiesIsLoading } = useGetBaseStudies({});
    const { data: points, isLoading: getPointsIsLoading } = useGetPoints();

    const isLoading = getStudiesIsLoading || getPointsIsLoading;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                minHeight: '40px',
            }}
        >
            {isLoading ? (
                <Skeleton animation="pulse" width={200} height={40} sx={{ marginRight: { xs: '0px', sm: '20px' } }} />
            ) : (
                <>
                    <Typography variant="h5" sx={{ color: 'white', marginRight: { xs: '0px', sm: '20px' } }}>
                        <b>{(studies?.metadata?.total_count || 0).toLocaleString()}</b> studies
                    </Typography>
                </>
            )}
            {isLoading ? (
                <Skeleton animation="pulse" width={200} height={40} />
            ) : (
                <Typography variant="h5" sx={{ color: 'white' }}>
                    <b>{(points?.metadata?.total_count || 0).toLocaleString()}</b> coordinates
                </Typography>
            )}
        </Box>
    );
};

export default NeurosynthActivitySummary;
