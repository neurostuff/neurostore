import { Box, Button, Typography } from '@mui/material';
import { ICurationSummary } from 'hooks/useGetCurationSummary';
import CloseIcon from '@mui/icons-material/Close';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { Link } from 'react-router-dom';

const ProjectPageCardSummaryCuration: React.FC<ICurationSummary & { projectId: string }> = (
    props
) => {
    const { excluded, included, uncategorized, projectId } = props;

    return (
        <Box>
            <Typography fontWeight="bold">Curation Summary:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.2rem 0 0.4rem 0' }}>
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
                sx={{ marginRight: '1rem', width: '180px' }}
                disableElevation
            >
                Go to curation board
            </Button>
            <Button
                component={Link}
                to={`/projects/${projectId}/curation/import`}
                variant="outlined"
                size="small"
                sx={{ width: '180px' }}
                disableElevation
            >
                Import into curation
            </Button>
        </Box>
    );
};

export default ProjectPageCardSummaryCuration;
