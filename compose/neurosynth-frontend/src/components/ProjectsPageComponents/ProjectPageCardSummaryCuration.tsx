import { Box, Button, Typography } from '@mui/material';
import { ICurationSummary } from 'hooks/useGetCurationSummary';

const ProjectPageCardSummaryCuration: React.FC<ICurationSummary> = (props) => {
    const { excluded, included, total, uncategorized } = props;

    return (
        <Box>
            <Typography gutterBottom>Curation summary</Typography>
            <Box>
                excluded: {excluded} | included: {included} | total: {total} | uncategorized:{' '}
                {uncategorized}
            </Box>
            <Button sx={{ marginRight: '1rem' }} variant="outlined" size="small" disableElevation>
                Import studies
            </Button>
            <Button variant="outlined" size="small" disableElevation>
                Go to curation board
            </Button>
        </Box>
    );
};

export default ProjectPageCardSummaryCuration;
