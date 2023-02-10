import { Draggable, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
import Close from '@mui/icons-material/Close';
import { Box, Chip, IconButton, Link, Paper, Tooltip, Typography } from '@mui/material';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import useUpdateCuration from 'hooks/requests/useUpdateCuration';

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

const handleAnimation = (
    style: DraggableStyle | undefined,
    snapshot: DraggableStateSnapshot,
    isVisible: boolean
) => {
    if (!snapshot.isDropAnimating) {
        return style;
    }

    if (isVisible) {
        return { ...style };
    } else {
        return {
            ...style,
            // cannot be 0, but make it super tiny
            transitionDuration: `0.001s`,
        };
    }
};

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        index: number;
        isVisible: boolean;
        columnIndex: number;
        onSelectStubStudy: (itemIndex: string) => void;
    }
> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { data } = useGetProjectById(projectId);
    const { removeExclusion, updateExclusionIsLoading } = useUpdateCuration(projectId);

    const handleRemoveExclusionTag = () => {
        removeExclusion(props.columnIndex, props.id);
    };

    const isLastColumn =
        (data?.provenance.curationMetadata?.columns || []).length <= props.columnIndex + 1;

    let exclusionTagElement: JSX.Element;
    if (isLastColumn) {
        exclusionTagElement = (
            <Box>
                <Typography sx={{ color: 'success.main' }}>included</Typography>
            </Box>
        );
    } else if (props.exclusionTag) {
        exclusionTagElement = (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'error.dark', fontWeight: 'bold' }}>
                    {props.exclusionTag.label}
                </Typography>
                <IconButton sx={{ padding: '2px' }} onClick={() => handleRemoveExclusionTag()}>
                    {updateExclusionIsLoading ? (
                        <ProgressLoader size={12} />
                    ) : (
                        <Close
                            sx={{
                                fontSize: '1rem',
                                color: 'error.dark',
                            }}
                        />
                    )}
                </IconButton>
            </Box>
        );
    } else {
        exclusionTagElement = (
            <Box>
                <Typography variant="body2" sx={{ color: 'warning.dark' }}>
                    uncategorized
                </Typography>
            </Box>
        );
    }

    return (
        <Draggable
            draggableId={props.id}
            index={props.index}
            isDragDisabled={!!props?.exclusionTag}
        >
            {(provided, snapshot) => (
                <Paper
                    elevation={1}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    sx={[
                        CurationStubStudyStyles.stubStudyContainer,
                        {
                            display: props.isVisible ? 'block' : 'none',
                            cursor: props.exclusionTag ? 'not-allowed' : 'pointer',
                        },
                    ]}
                    style={handleAnimation(
                        provided.draggableProps.style,
                        snapshot,
                        props.isVisible
                    )}
                >
                    <Box sx={CurationStubStudyStyles.exclusionContainer}>{exclusionTagElement}</Box>
                    <Link
                        underline="hover"
                        sx={{ marginBottom: '0.25rem', cursor: 'pointer' }}
                        onClick={() => props.onSelectStubStudy(props.id)}
                        variant="body1"
                    >
                        <Typography noWrap>{props.title}</Typography>
                    </Link>
                    <Typography sx={CurationStubStudyStyles.limitText}>{props.authors}</Typography>
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
                </Paper>
            )}
        </Draggable>
    );
};

export default CurationStubStudy;
