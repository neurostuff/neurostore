import { Draggable } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React, { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import AddTagSelectorPopup from './AddTagSelectorPopup.tsx/AddTagSelectorPopup';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import { IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export interface IDraggableItem {
    id: string;
    isDraft?: boolean;
    title: string;
    authors: string;
    keywords: string[];
    pmid: string;
    doi: string;
    articleYear: number | undefined;
    abstractText: string | { label: string; text: string }[];
    articleLink: string;
    exclusion?: ITag;
    tags: ITag[];
}

export interface ITag {
    label: string;
    id: string;
    isExclusion: boolean;
}

const DraggableItem: React.FC<{
    item: IDraggableItem;
    index: number;
    isVisible: boolean;
    onCreateTag: (tagName: string, isExclusion: boolean) => ITag;
    onSetItem: (item: IDraggableItem) => void;
    onSelectItem: (itemId: string) => void;
    allInfoTags: ITag[];
    allExclusions: ITag[];
}> = (props) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleSetExclusion = (tag: ITag) => {
        props.onSetItem({
            ...props.item,
            exclusion: tag,
        });
        setIsOpen(false);
    };

    const handleCreateExclusion = (tagName: string) => {
        const newTag = props.onCreateTag(tagName, true);
        handleSetExclusion(newTag);
    };

    const handleRemoveExclusion = () => {
        props.onSetItem({
            ...props.item,
            exclusion: undefined,
        });
        setIsOpen(false);
    };

    return (
        <Draggable
            draggableId={props.item.id}
            index={props.index}
            isDragDisabled={props.item.exclusion !== undefined}
        >
            {(provided) => (
                <Paper
                    elevation={1}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    sx={{
                        padding: '10px',
                        marginBottom: '10px',
                        display: props.isVisible ? 'block' : 'none',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.25rem',
                        }}
                    >
                        {props.item.exclusion ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ color: 'error.dark' }}>
                                    {props.item.exclusion.label}
                                </Typography>
                                <IconButton onClick={() => handleRemoveExclusion()}>
                                    <Close sx={{ fontSize: '1rem', color: 'error.dark' }} />
                                </IconButton>
                            </Box>
                        ) : (
                            <>
                                <NeurosynthPopper
                                    open={isOpen}
                                    anchorElement={anchorRef.current}
                                    onClickAway={() => setIsOpen(false)}
                                >
                                    <AddTagSelectorPopup
                                        tags={props.allExclusions}
                                        onAddTag={handleSetExclusion}
                                        onCreateTag={handleCreateExclusion}
                                    />
                                </NeurosynthPopper>
                                <Button
                                    ref={anchorRef}
                                    onClick={() => {
                                        setIsOpen(true);
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
                        {(props.item.isDraft === undefined || props.item.isDraft === true) && (
                            <Typography sx={{ color: 'muted.main' }}>(stub)</Typography>
                        )}
                    </Box>
                    <Link
                        onClick={() => props.onSelectItem(props.item.id)}
                        underline="hover"
                        sx={{ marginBottom: '0.25rem' }}
                    >
                        <Typography
                            sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipses',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                lineClamp: 1,
                                cursor: 'pointer',
                            }}
                            variant="body1"
                        >
                            {props.item.title}
                        </Typography>
                    </Link>
                    <Typography
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipses',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            lineClamp: 1,
                            cursor: 'pointer',
                            color: 'muted.main',
                        }}
                        variant="caption"
                    >
                        {props.item.authors}
                    </Typography>
                    <Box
                        sx={{
                            padding: '5px 0',
                            overflowY: 'auto',
                        }}
                    >
                        {props.item.tags.map((tag) => (
                            <Tooltip title={tag.label} key={tag.id}>
                                <Chip
                                    sx={{
                                        marginRight: '4px',
                                        marginTop: '4px',
                                        fontSize: '',
                                        maxWidth: '180px',
                                    }}
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

export default DraggableItem;
