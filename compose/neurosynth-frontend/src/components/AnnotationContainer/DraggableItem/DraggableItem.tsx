import { Draggable } from '@hello-pangea/dnd';
import Add from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React, { useRef, useState } from 'react';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ConditionSelector from 'components/EditStudyComponents/EditAnalyses/EditAnalysis/EditAnalysisConditions/ConditionSelector/ConditionSelector';
import AddTagSelectorPopup from './AddTagSelectorPopup.tsx/AddTagSelectorPopup';

export interface IDraggableItem {
    id: string;
    title: string;
    authors: string;
    tag?: { label: string; id: string };
}

const DraggableItem: React.FC<
    IDraggableItem & {
        index: number;
        onDeleteTag: (id: string) => void;
        onCreateTag: (itemId: string, tagName: string) => void;
        onAddTag: (itemId: string, tag: { id: string; label: string }) => void;
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
                        <Typography>(draft)</Typography>
                        {props.tag ? (
                            <Chip
                                sx={{ marginTop: '0.25rem' }}
                                color="secondary"
                                label={props.tag.label}
                                variant="outlined"
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
                                        console.log('setting to true');

                                        setIsOpen(true);
                                    }}
                                    startIcon={<Add />}
                                    size="small"
                                    color="primary"
                                >
                                    tag
                                </Button>
                            </>
                        )}
                    </Box>
                    <Typography variant="body1" sx={{ marginBottom: '0.25rem' }}>
                        {props.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'muted.main' }}>
                        {props.authors}
                    </Typography>
                </Paper>
            )}
        </Draggable>
    );
};

export default DraggableItem;
