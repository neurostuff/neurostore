import { Box, IconButton, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
} from 'pages/Projects/ProjectPage/ProjectStore';

const FloatingStatusButtons: React.FC<{ studyId: string }> = (props) => {
    const extractionStatus = useProjectExtractionStudyStatus(props.studyId);
    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClickStudyListStatus = (status: 'COMPLETE' | 'SAVEFORLATER') => {
        if (props.studyId) {
            updateStudyListStatus(props.studyId, status);
        }
    };

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
                        <IconButton
                            sx={{
                                backgroundColor:
                                    extractionStatus?.status === 'COMPLETE' ? 'lightgray' : '',
                            }}
                            onClick={() => handleClickStudyListStatus('COMPLETE')}
                        >
                            <CheckIcon color="success" />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Box>
                    <Tooltip placement="right" title="save for later">
                        <IconButton
                            sx={{
                                backgroundColor:
                                    extractionStatus?.status === 'SAVEFORLATER' ? 'lightgray' : '',
                            }}
                            onClick={() => handleClickStudyListStatus('SAVEFORLATER')}
                        >
                            <BookmarkIcon color="info" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
};

export default FloatingStatusButtons;
