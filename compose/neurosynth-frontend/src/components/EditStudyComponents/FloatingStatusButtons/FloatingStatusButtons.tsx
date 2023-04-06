import { Box, IconButton, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';

const FloatingStatusButtons: React.FC = (props) => {
    return (
        <Box
            sx={{
                position: 'sticky',
                top: 15,
            }}
        >
            <Box sx={{ position: 'absolute', right: '-8%' }}>
                <Box sx={{ marginBottom: '1rem' }}>
                    <Tooltip placement="right" title="mark as complete">
                        <IconButton sx={{ backgroundColor: 'lightgray' }}>
                            <CheckIcon color="success" />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Box>
                    <Tooltip placement="right" title="save for later">
                        <IconButton>
                            <BookmarkIcon color="info" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
};

export default FloatingStatusButtons;
