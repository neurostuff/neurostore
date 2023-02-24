import { Draggable, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
import { Box, Chip, Paper, Tooltip, Typography } from '@mui/material';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useProjectCurationColumns } from 'pages/Projects/ProjectPage/ProjectStore';

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string;
    pmid: string;
    doi: string;
    articleYear: string | undefined;
    journal: string;
    abstractText: string;
    articleLink: string;
    exclusionTag: ITag | null;
    identificationSource: ISource;
    tags: ITag[];
}

const handleAnimation = (style: DraggableStyle | undefined, snapshot: DraggableStateSnapshot) => {
    if (!snapshot.isDropAnimating) {
        return style;
    }
    return {
        ...style,
        // cannot be 0, but make it super tiny
        transitionDuration: `0.001s`,
    };
};

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        index: number;
        isVisible: boolean;
        columnIndex: number;
        onSelectStubStudy: (stubId: string) => void;
    }
> = (props) => {
    const columns = useProjectCurationColumns();

    const isLastColumn = columns.length <= props.columnIndex + 1;

    return (
        <Draggable
            draggableId={props.id}
            index={props.index}
            isDragDisabled={!!props?.exclusionTag}
        >
            {(provided, snapshot) => (
                <Paper
                    onClick={() => props.onSelectStubStudy(props.id)}
                    elevation={1}
                    {...provided.draggableProps}
                    ref={provided.innerRef}
                    sx={[
                        CurationStubStudyStyles.stubStudyContainer,
                        {
                            display: props.isVisible ? 'flex' : 'none',
                        },
                    ]}
                    style={handleAnimation(provided.draggableProps.style, snapshot)}
                >
                    {!props?.exclusionTag ? (
                        <Box
                            {...provided.dragHandleProps}
                            sx={{ display: 'flex', alignItems: 'center', width: '30px' }}
                        >
                            <Box>
                                <DragIndicatorIcon sx={{ color: 'gray' }} />
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ width: '30px' }}></Box>
                    )}
                    <Box sx={{ width: 'calc(100% - 30px)' }}>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: props.exclusionTag ? 'bold' : undefined,
                                marginBottom: '0',
                                color: isLastColumn
                                    ? 'success.main'
                                    : props.exclusionTag
                                    ? 'error.dark'
                                    : 'warning.main',
                            }}
                        >
                            {isLastColumn
                                ? 'included'
                                : props.exclusionTag
                                ? props.exclusionTag.label
                                : 'uncategorized'}
                        </Typography>
                        <Typography noWrap variant="body1" color="primary">
                            {props.title}
                        </Typography>
                        <Typography noWrap>{props.authors}</Typography>
                        <Box sx={{ display: 'flex' }}>
                            {props.articleYear && (
                                <Typography sx={{ marginRight: '4px' }} variant="caption">
                                    ({props.articleYear})
                                </Typography>
                            )}
                            <Typography variant="caption">{props.journal}</Typography>
                        </Box>
                        <Box sx={{ padding: '5px 0', overflow: 'auto' }}>
                            {props.tags.map((tag) => (
                                <Tooltip title={tag.label} key={tag.id}>
                                    <Chip
                                        sx={CurationStubStudyStyles.tag}
                                        size="small"
                                        label={tag.label}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                    </Box>
                </Paper>
            )}
        </Draggable>
    );
};

export default CurationStubStudy;
