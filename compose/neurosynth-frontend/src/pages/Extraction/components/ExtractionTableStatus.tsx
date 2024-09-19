import { ArrowDownward, CheckCircle, QuestionMark } from '@mui/icons-material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Box, Button, ButtonGroup, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { useProjectExtractionAddOrUpdateStudyListStatus } from 'pages/Project/store/ProjectStore';
import { EExtractionStatus } from '../ExtractionPage';
import { IExtractionTableStudy } from './ExtractionTable';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export const ExtractionTableStatusCell: React.FC<
    CellContext<IExtractionTableStudy, EExtractionStatus | undefined>
> = (props) => {
    const status = props.getValue();

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    return (
        <Box>
            <ButtonGroup>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(
                            props.row.original.id || '',
                            EExtractionStatus.UNCATEGORIZED
                        );
                    }}
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="warning"
                    variant={
                        status === undefined || status === EExtractionStatus.UNCATEGORIZED
                            ? 'contained'
                            : 'outlined'
                    }
                >
                    <QuestionMark />
                </Button>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(
                            props.row.original.id || '',
                            EExtractionStatus.SAVEDFORLATER
                        );
                    }}
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="info"
                    variant={status === EExtractionStatus.SAVEDFORLATER ? 'contained' : 'outlined'}
                >
                    <BookmarkIcon />
                </Button>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(
                            props.row.original.id || '',
                            EExtractionStatus.COMPLETED
                        );
                    }}
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

export const ExtractionTableStatusHeader: React.FC<
    HeaderContext<IExtractionTableStudy, unknown>
> = ({ table, column }) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Sort by status" placement="top">
                <Typography
                    sx={{ ':hover': { cursor: 'pointer' } }}
                    underline="hover"
                    variant="h6"
                    component={Link}
                    onClick={() => {
                        if (!!isSorted) {
                            table.resetSorting();
                        } else {
                            table.setSorting([{ id: 'status', desc: true }]);
                        }
                    }}
                >
                    Status
                </Typography>
            </Tooltip>
            {!!isSorted && (
                <>
                    {isSorted === 'asc' ? (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'status', desc: true }])}
                        >
                            <ArrowUpwardIcon />
                        </IconButton>
                    ) : (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'status', desc: false }])}
                        >
                            <ArrowDownward />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
};
