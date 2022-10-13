import { Draggable } from '@hello-pangea/dnd';
import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React, { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import AddTagSelectorPopup from './AddTagSelectorPopup.tsx/AddTagSelectorPopup';
import Link from '@mui/material/Link';

export interface IDraggableItem {
    id: string;
    isDraft?: boolean;
    title: string;
    authors: string;
    keywords: string[];
    pmid: string;
    doi: string;
    abstractText: string | { label: string; text: string }[];
    articleLink: string;
    tag?: { label: string; id: string };
}

const DraggableItem: React.FC<
    IDraggableItem & {
        index: number;
        onDeleteTag: (id: string) => void;
        onCreateTag: (itemId: string, tagName: string) => void;
        onAddTag: (itemId: string, tag: { id: string; label: string }) => void;
        onSelectItem: (itemId: string) => void;
        tags: { label: string; id: string }[];
    }
> = (props) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleAddTag = (tag: { label: string; id: string }) => {
        setIsOpen(false);
        props.onAddTag(props.id, tag);
    };

    const handleCreateTag = (tagName: string) => {
        setIsOpen(false);
        props.onCreateTag(props.id, tagName);
    };

    const handleDeleteTag = (id: string) => {
        setIsOpen(false);
        props.onDeleteTag(id);
    };

    return (
        <Draggable draggableId={props.id} index={props.index}>
            {(provided) => (
                <Paper
                    elevation={1}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    sx={{ padding: '14px 10px', marginBottom: '10px' }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.25rem',
                        }}
                    >
                        {(props.isDraft === undefined || props.isDraft === true) && (
                            <Typography sx={{ color: 'muted.main', marginRight: '1rem' }}>
                                (draft)
                            </Typography>
                        )}
                        {props.tag ? (
                            <Chip
                                sx={{ marginTop: '0.25rem' }}
                                color="error"
                                label={props.tag.label}
                                variant="filled"
                                onDelete={(event: any) => handleDeleteTag(props.id)}
                            />
                        ) : (
                            <>
                                <NeurosynthPopper
                                    open={isOpen}
                                    anchorElement={anchorRef.current}
                                    onClickAway={() => setIsOpen(false)}
                                >
                                    <AddTagSelectorPopup
                                        tags={props.tags}
                                        onAddTag={handleAddTag}
                                        onCreateTag={handleCreateTag}
                                    />
                                </NeurosynthPopper>
                                <Button
                                    ref={anchorRef}
                                    onClick={() => {
                                        setIsOpen(true);
                                    }}
                                    startIcon={<Add />}
                                    size="small"
                                    color="error"
                                >
                                    exclusion
                                </Button>
                            </>
                        )}
                    </Box>
                    <Link
                        onClick={() => props.onSelectItem(props.id)}
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
                            {props.title}
                        </Typography>
                    </Link>
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'muted.main',
                            overflow: 'hidden',
                            textOverflow: 'ellipses',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            lineClamp: 1,
                        }}
                    >
                        {props.authors}
                    </Typography>
                </Paper>
            )}
        </Draggable>
    );
};

export default DraggableItem;
