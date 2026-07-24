import { Box, Button, Typography } from '@mui/material';
import { IExtractionSummary } from 'hooks/useGetExtractionSummary';
import { Bookmark, Check, QuestionMark } from '@mui/icons-material';
import { Link } from 'react-router-dom';

const ProjectsPageCardExtractionSummary = (props: IExtractionSummary & { projectId: string }) => {
    const { savedForLater, completed, unreviewed: uncategorized, projectId } = props;

    return (
        <Box>
            <Typography fontWeight="bold">Extraction Summary:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0 0.7rem 0' }}>
                <Box sx={{ display: 'flex' }}>
                    <QuestionMark color="warning" fontSize="small" />
                    <Typography color="warning.dark" mr="2rem">
                        {uncategorized} unreviewed
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <Bookmark color="info" fontSize="small" />
                    <Typography color="info.dark" mr="2rem">
                        {savedForLater} saved for later
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <Check color="success" />
                    <Typography color="success.main">{completed} completed</Typography>
                </Box>
            </Box>
            <Button
                component={Link}
                to={`/projects/${projectId}/extraction`}
                variant="outlined"
                size="small"
                sx={{ marginRight: '1rem', width: '180px' }}
                disableElevation
            >
                Go to extraction
            </Button>
        </Box>
    );
};

export default ProjectsPageCardExtractionSummary;
