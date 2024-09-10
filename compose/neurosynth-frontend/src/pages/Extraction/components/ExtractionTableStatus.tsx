import { CheckCircle, QuestionMark } from '@mui/icons-material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { EExtractionStatus } from '../ExtractionPage';

export const ExtractionTableStatusCell: React.FC<
    CellContext<StudyReturn, IStudyExtractionStatus | undefined>
> = (props) => {
    const value = props.getValue();
    const status = value?.status;
    return (
        <Box>
            <ButtonGroup>
                <Button
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="warning"
                    variant={!status ? 'contained' : 'outlined'}
                >
                    <QuestionMark />
                </Button>
                <Button
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="info"
                    variant={status === EExtractionStatus.SAVEDFORLATER ? 'contained' : 'outlined'}
                >
                    <BookmarkIcon />
                </Button>
                <Button
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="success"
                    variant={status === EExtractionStatus.COMPLETED ? 'contained' : 'outlined'}
                >
                    <CheckCircle />
                </Button>
            </ButtonGroup>
        </Box>
    );
};

export const ExtractionTableStatusHeader: React.FC<HeaderContext<StudyReturn, unknown>> = (
    props
) => {
    return <Typography>Status</Typography>;
};
