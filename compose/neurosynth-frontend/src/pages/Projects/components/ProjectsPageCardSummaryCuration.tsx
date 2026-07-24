import { Box, Button, Typography } from '@mui/material';
import { ICurationSummary } from 'hooks/useGetCurationSummary';
import {
    Close as CloseIcon,
    PlaylistAddCheck as PlaylistAddCheckIcon,
    QuestionMark as QuestionMarkIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

const ProjectsPageCardSummaryCuration = (props: ICurationSummary & { projectId: string }) => {
    const { excluded, included, uncategorized, projectId } = props;

    return (
        <Box>
            <Typography fontWeight="bold">Curation Summary:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0 0.7rem 0' }}>
                <Box sx={{ display: 'flex' }}>
                    <QuestionMarkIcon color="warning" fontSize="small" />
                    <Typography mr="2rem" color="warning.dark">
                        {uncategorized} uncategorized
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <CloseIcon color="error" fontSize="small" />
                    <Typography color="error.dark" mr="2rem">
                        {excluded} excluded
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <PlaylistAddCheckIcon color="success" />
                    <Typography color="success.main">{included} included</Typography>
                </Box>
            </Box>
            <Button
                component={Link}
                to={`/projects/${projectId}/curation`}
                variant="outlined"
                size="small"
                sx={{ width: '180px' }}
                disableElevation
            >
                Go to curation board
            </Button>
        </Box>
    );
};

export default ProjectsPageCardSummaryCuration;
