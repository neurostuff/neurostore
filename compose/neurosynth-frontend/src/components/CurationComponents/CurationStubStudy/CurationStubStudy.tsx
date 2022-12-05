import { Draggable } from '@hello-pangea/dnd';
import Close from '@mui/icons-material/Close';
import { Box, Button, Chip, IconButton, Link, Paper, Tooltip, Typography } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ITag } from 'hooks/requests/useGetProjects';
import { useRef, useState } from 'react';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import CurationStubStudyStyles from './CurationStubStudy.styles';

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string[];
    pmid: string;
    doi: string;
    articleYear: number | undefined;
    abstractText: string | { label: string; text: string }[];
    articleLink: string;
    exclusionTag?: ITag;
    tags: ITag[];
}

const CurationStubStudy: React.FC<
    ICurationStubStudy & {
        index: number;
        isVisible: boolean;
        onSelectStubStudy: (itemId: string) => void;
    }
> = (props) => {
    const [tagSelectorPopupIsOpen, setTagSelectorPopupIsOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const handleOnAddTag = (tag: ITag) => {
        setTagSelectorPopupIsOpen(false);
    };

    return (
        <Draggable
            draggableId={props.id}
            index={props.index}
            isDragDisabled={props?.exclusionTag !== undefined}
        >
            {(provided) => (
                <Paper
                    elevation={1}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    sx={[
                        CurationStubStudyStyles.stubStudyContainer,
                        {
                            display: props.isVisible ? 'block' : 'none',
                        },
                    ]}
                >
                    <Box sx={CurationStubStudyStyles.exclusionContainer}>
                        {props.exclusionTag ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ color: 'error.dark' }}>
                                    {props.exclusionTag.label}
                                </Typography>
                                <IconButton onClick={() => {}}>
                                    <Close sx={{ fontSize: '1rem', color: 'error.dark' }} />
                                </IconButton>
                            </Box>
                        ) : (
                            <>
                                <NeurosynthPopper
                                    open={tagSelectorPopupIsOpen}
                                    anchorElement={anchorRef.current}
                                    onClickAway={() => setTagSelectorPopupIsOpen(false)}
                                >
                                    <TagSelectorPopup
                                        onAddTag={handleOnAddTag}
                                        isExclusion={true}
                                        label="Add exclusion"
                                    />
                                </NeurosynthPopper>
                                <Button
                                    ref={anchorRef}
                                    onClick={() => {
                                        setTagSelectorPopupIsOpen(true);
                                    }}
                                    endIcon={<ArrowDropDownIcon />}
                                    size="small"
                                    sx={{
                                        // make down arrow closer to button text
                                        '.MuiButton-iconSizeSmall': {
                                            marginLeft: '2px',
                                        },
                                    }}
                                    color="error"
                                >
                                    exclude
                                </Button>
                            </>
                        )}
                    </Box>
                    <Link
                        underline="hover"
                        sx={{ marginBottom: '0.25rem' }}
                        onClick={() => props.onSelectStubStudy(props.id)}
                        variant="body1"
                    >
                        <Typography sx={CurationStubStudyStyles.limitText}>
                            {props.title}
                        </Typography>
                    </Link>
                    <Typography sx={CurationStubStudyStyles.limitText}>{props.authors}</Typography>
                    <Typography variant="caption">{props.articleYear}</Typography>
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
