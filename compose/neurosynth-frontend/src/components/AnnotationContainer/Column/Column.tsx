import { Droppable } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import DraggableItem, { IDraggableItem } from '../DraggableItem/DraggableItem';
import Paper from '@mui/material/Paper';
import { useState } from 'react';
import { Button } from '@mui/material';
import AnnotateDialog from 'components/Dialogs/AnnotateDialog/AnnotateDialog';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

interface IColumn {
    items: IDraggableItem[];
    columnId: string;
    columnTitle: string;
    onUpdateItems: (colId: string, item: IDraggableItem[]) => void;
    onDeleteTag: (colId: string, itemId: string) => void;
    onCreateTag: (tagName: string) => { id: string; label: string };
    onAddTag: (colId: string, itemId: string, tag: { id: string; label: string }) => void;
    tags: { label: string; id: string }[];
}

const Column: React.FC<IColumn> = (props) => {
    const [filterDialogIsOpen, setFilterDialogIsOpen] = useState(false);
    const [initialFilterSelectedItemIndex, setInitialFilterSelectedItemIndex] = useState(0);
    const [selectedTag, setSelectedTag] = useState<{ id: string; label: string }>();

    const handleAddTag = (itemId: string, tag: { id: string; label: string }) => {
        props.onAddTag(props.columnId, itemId, tag);
    };

    const handleCreateTag = (itemId: string, tagName: string) => {
        const tag = props.onCreateTag(tagName);
        props.onAddTag(props.columnId, itemId, tag);
    };

    const handleCloseFilterDialog = () => {
        setFilterDialogIsOpen(false);
        setInitialFilterSelectedItemIndex(0);
    };

    const handleSelectItem = (itemId: string) => {
        const itemIndex = props.items.findIndex((x) => x.id === itemId);
        if (itemIndex < 0) return;
        setInitialFilterSelectedItemIndex(itemIndex);
        setFilterDialogIsOpen(true);
    };

    return (
        <Box
            sx={{
                backgroundColor: 'rgb(244, 245, 247)',
                margin: '4px',
                padding: '0.75rem',
                borderRadius: '2px',
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 0px',
            }}
        >
            <Button
                variant="text"
                onClick={() => setFilterDialogIsOpen(true)}
                sx={{ padding: '8px', color: 'rgb(94, 108, 132)', marginBottom: '1rem' }}
            >
                {props.columnTitle} ({props.items.length})
            </Button>

            <AnnotateDialog
                onCreateTag={props.onCreateTag}
                tags={props.tags}
                onUpdateItems={(items) => props.onUpdateItems(props.columnId, items)}
                isOpen={filterDialogIsOpen}
                items={props.items}
                onCloseDialog={handleCloseFilterDialog}
                selectedItemIndex={initialFilterSelectedItemIndex}
            />

            <Paper elevation={0} sx={{ width: '100%' }}>
                <NeurosynthAutocomplete
                    noOptionsText="No tags"
                    required={false}
                    value={selectedTag}
                    label="filter by tag"
                    options={[...props.tags, { label: 'untagged', id: 'fordemopurposesonly' }]}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newValue, _reason) => {
                        setSelectedTag(newValue || undefined);
                    }}
                />
            </Paper>
            <Divider sx={{ margin: '1rem 0' }} />
            <Droppable droppableId={props.columnId}>
                {(provided) => (
                    <Box
                        sx={{
                            maxHeight: '800px',
                            overflowY: 'scroll',
                            flexGrow: 1,
                            padding: '0.5rem',
                        }}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {props.items.length === 0 && (
                            <Typography sx={{ marginBottom: '0.5rem' }} color="warning.dark">
                                No studies
                            </Typography>
                        )}
                        {props.items.map((item, index) => (
                            <DraggableItem
                                onSelectItem={handleSelectItem}
                                onCreateTag={handleCreateTag}
                                onAddTag={handleAddTag}
                                tags={props.tags}
                                onDeleteTag={(id) => props.onDeleteTag(props.columnId, id)}
                                key={item.id}
                                {...item}
                                index={index}
                            />
                        ))}
                        {provided.placeholder}
                    </Box>
                )}
            </Droppable>
        </Box>
    );
};

export default Column;
