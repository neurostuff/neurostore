import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StudyListItemStyles from './ReadOnlyStudySummary.styles';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { useHistory, useParams } from 'react-router-dom';
import { ESelectedChip } from 'pages/ExtractionPage/ExtractionPage';
import { useProjectExtractionAddOrUpdateStudyListStatus } from 'pages/Projects/ProjectPage/ProjectStore';

const ReadOnlyStudySummary: React.FC<StudyReturn & { currentSelectedChip: ESelectedChip }> = (
    props
) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
    const addOrUpdateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClick = (_event: React.MouseEvent) => {
        if (props?.id) {
            history.push(`/projects/${projectId}/extraction/studies/${props.id}`);
        }
    };

    const handleUpdateStatus = (studyId: string, status: 'COMPLETE' | 'SAVEFORLATER') => {
        if (studyId) {
            addOrUpdateStudyListStatus(studyId, status);
        }
    };

    const showMarkAsCompleteButton =
        props.currentSelectedChip === ESelectedChip.UNCATEGORIZED ||
        props.currentSelectedChip === ESelectedChip.SAVEDFORLATER;

    const showMarkAsSaveForLaterbutton =
        props.currentSelectedChip === ESelectedChip.UNCATEGORIZED ||
        props.currentSelectedChip === ESelectedChip.COMPLETED;

    return (
        <Box sx={StudyListItemStyles.listItem}>
            <Box sx={{ width: 'calc(100% - 80px)' }}>
                <Box onClick={handleClick} sx={{ padding: '0 1rem' }}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                        {`${props.year ? `(${props.year}) ` : ''}${props.name}`}
                    </Typography>
                    <Typography>{props.authors}</Typography>
                    <Typography>Journal: {props.publication}</Typography>
                    <Box sx={{ display: 'flex' }}>
                        <Typography sx={{ width: '220px' }}>PMID: {props.pmid}</Typography>
                        <Typography>DOI: {props.doi}</Typography>
                    </Box>
                </Box>
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '80px',
                }}
            >
                {showMarkAsCompleteButton && (
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip placement="right" title="mark as complete">
                            <IconButton
                                size="large"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleUpdateStatus(props.id || '', 'COMPLETE');
                                }}
                            >
                                <CheckIcon color="success" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
                {showMarkAsSaveForLaterbutton && (
                    <Box>
                        <Tooltip placement="right" title="save for later">
                            <IconButton
                                size="large"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleUpdateStatus(props.id || '', 'SAVEFORLATER');
                                }}
                            >
                                <BookmarkIcon color="info" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default ReadOnlyStudySummary;
