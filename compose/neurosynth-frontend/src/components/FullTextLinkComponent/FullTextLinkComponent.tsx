import { Box, Link, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useGetFullText from 'hooks/requests/useGetFullText';

const FullTextLinkComponent: React.FC<{ paperTitle: string; text?: string }> = (props) => {
    const { paperTitle, text = 'article full text' } = props;
    const { data, isLoading, isError } = useGetFullText(paperTitle);

    if (isError) {
        return (
            <Typography sx={{ color: 'error.main' }}>
                There was an error retrieving the full text
            </Typography>
        );
    }

    if (isLoading) {
        return (
            <Box sx={{ margin: '0 10px' }}>
                <ProgressLoader size={20} />
            </Box>
        );
    }

    if (data) {
        return (
            <Link underline="hover" target="_blank" href={data} sx={{ marginRight: '10px' }}>
                {text}
            </Link>
        );
    }

    return (
        <Typography sx={{ color: 'warning.dark', marginRight: '10px' }}>
            could not retrieve full text
        </Typography>
    );
};

export default FullTextLinkComponent;
