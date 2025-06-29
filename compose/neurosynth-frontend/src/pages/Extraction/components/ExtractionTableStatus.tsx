import { ArrowDownward, CheckCircle, QuestionMark } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Box, Button, ButtonGroup, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { useProjectExtractionAddOrUpdateStudyListStatus } from 'pages/Project/store/ProjectStore';
import { EExtractionStatus } from '../ExtractionPage';
import { IExtractionTableStudy } from './ExtractionTable';

export const ExtractionTableStatusCell: React.FC<CellContext<IExtractionTableStudy, EExtractionStatus | undefined>> = (
    props
) => {
    const status = props.getValue();

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    return (
        <Box>
            <ButtonGroup>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(props.row.original.id || '', EExtractionStatus.UNCATEGORIZED);
                    }}
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="warning"
                    size="small"
                    variant={
                        status === undefined || status === EExtractionStatus.UNCATEGORIZED ? 'contained' : 'outlined'
                    }
                >
                    <QuestionMark />
                </Button>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(props.row.original.id || '', EExtractionStatus.SAVEDFORLATER);
                    }}
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="info"
                    size="small"
                    variant={status === EExtractionStatus.SAVEDFORLATER ? 'contained' : 'outlined'}
                >
                    <BookmarkIcon />
                </Button>
                <Button
                    onClick={(event) => {
                        event.stopPropagation();
                        updateStudyListStatus(props.row.original.id || '', EExtractionStatus.COMPLETED);
                    }}
                    disableElevation
                    sx={{ paddingX: '0' }}
                    color="success"
                    size="small"
                    variant={status === EExtractionStatus.COMPLETED ? 'contained' : 'outlined'}
                >
                    <CheckCircle />
                </Button>
            </ButtonGroup>
        </Box>
    );
};

export const ExtractionTableStatusHeader: React.FC<HeaderContext<IExtractionTableStudy, unknown>> = ({
    table,
    column,
}) => {
    const columnLabel = column.columnDef.meta?.columnLabel || '';
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ marginRight: '4px' }}>
                {columnLabel}
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by Status" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'status', desc: true }]);
                            }
                        }}
                    >
                        <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'lightgray' }} />
                    </IconButton>
                </Tooltip>
            ) : isSorted === 'asc' ? (
                <IconButton size="small" onClick={() => table.resetSorting()}>
                    <ArrowUpwardIcon sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            ) : (
                <IconButton size="small" onClick={() => table.setSorting([{ id: 'status', desc: false }])}>
                    <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            )}
        </Box>
    );
};
