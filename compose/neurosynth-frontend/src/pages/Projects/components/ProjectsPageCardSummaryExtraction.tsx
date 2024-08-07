import { Box, Button, Typography } from '@mui/material';
import { IExtractionSummary } from 'hooks/useGetExtractionSummary';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { Link } from 'react-router-dom';

const ProjectsPageCardExtractionSummary: React.FC<IExtractionSummary & { projectId: string }> = (
    props
) => {
    const { savedForLater, completed, uncategorized, projectId } = props;

    return (
        <Box>
            <Typography fontWeight="bold">Extraction Summary:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0 0.7rem 0' }}>
                <Box sx={{ display: 'flex' }}>
                    <QuestionMarkIcon color="warning" fontSize="small" />
                    <Typography color="warning.dark" mr="2rem">
                        {uncategorized} uncategorized
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <BookmarkIcon color="info" fontSize="small" />
                    <Typography color="info.dark" mr="2rem">
                        {savedForLater} saved for later
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <CheckIcon color="success" />
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
