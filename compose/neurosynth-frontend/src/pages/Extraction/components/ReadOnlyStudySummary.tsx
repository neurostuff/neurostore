import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StudyListItemStyles from './ReadOnlyStudySummary.styles';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { useNavigate, useParams } from 'react-router-dom';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import useUserCanEdit from 'hooks/useUserCanEdit';

const ReadOnlyStudySummaryVirtualizedItem: React.FC<
    StudyReturn & {
        currentSelectedChip: EExtractionStatus;
        canEdit: boolean;
        style: React.CSSProperties;
    }
> = (props) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const addOrUpdateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();
    const projectUser = useProjectUser();
    const userCanEdit = useUserCanEdit(projectUser ?? undefined);

    const handleClick = (_event: React.MouseEvent) => {
        if (!props?.id) return;

        userCanEdit
            ? navigate(`/projects/${projectId}/extraction/studies/${props.id}/edit`)
            : navigate(`/projects/${projectId}/extraction/studies/${props.id}`);
    };

    const handleUpdateStatus = (studyId: string, status: EExtractionStatus) => {
        if (studyId) {
            addOrUpdateStudyListStatus(studyId, status);
        }
    };

    const showMarkAsCompleteButton =
        props.currentSelectedChip === EExtractionStatus.UNCATEGORIZED ||
        props.currentSelectedChip === EExtractionStatus.SAVEDFORLATER;

    const showMarkAsSaveForLaterButton =
        props.currentSelectedChip === EExtractionStatus.UNCATEGORIZED ||
        props.currentSelectedChip === EExtractionStatus.COMPLETED;

    return (
        <Box style={props.style}>
            <Box onClick={handleClick} sx={StudyListItemStyles.listItem}>
                <Box sx={{ width: 'calc(100% - 70px)' }}>
                    <Typography noWrap sx={{ fontWeight: 'bold' }}>
                        {`${props.year ? `(${props.year}) ` : ''}${props.name}`}
                    </Typography>
                    <Typography noWrap>{props.authors}</Typography>
                    <Typography noWrap>Journal: {props.publication}</Typography>
                    <Box sx={{ display: 'flex' }}>
                        <Typography sx={{ width: '220px' }}>PMID: {props.pmid}</Typography>
                        <Typography>DOI: {props.doi}</Typography>
                    </Box>
                    <Typography noWrap>{props.description}</Typography>
                </Box>
                {props.canEdit && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '70px',
                        }}
                    >
                        {showMarkAsCompleteButton && (
                            <Box sx={{ marginBottom: '1rem' }}>
                                <Tooltip placement="right" title="move to complete">
                                    <IconButton
                                        size="large"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleUpdateStatus(
                                                props.id || '',
                                                EExtractionStatus.COMPLETED
                                            );
                                        }}
                                    >
                                        <CheckIcon color="success" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                        {showMarkAsSaveForLaterButton && (
                            <Box>
                                <Tooltip placement="right" title="move to save for later">
                                    <IconButton
                                        size="large"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleUpdateStatus(
                                                props.id || '',
                                                EExtractionStatus.SAVEDFORLATER
                                            );
                                        }}
                                    >
                                        <BookmarkIcon color="info" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default ReadOnlyStudySummaryVirtualizedItem;
