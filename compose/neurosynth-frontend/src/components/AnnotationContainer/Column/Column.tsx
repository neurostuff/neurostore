import { Droppable } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import DraggableItem, { IDraggableItem, ITag } from '../DraggableItem/DraggableItem';
import Paper from '@mui/material/Paper';
import { useState } from 'react';
import { Button, ListItem, ListItemText } from '@mui/material';
import AnnotateDialog from 'components/Dialogs/AnnotateDialog/AnnotateDialog';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

interface IColumn {
    items: IDraggableItem[];
    columnId: string;
    columnTitle: string;
    onCreateTag: (tagName: string, isExclusion: boolean) => ITag;
    onSetItem: (columnId: string, item: IDraggableItem) => void;
    tags: ITag[];
    onInclude: (columnId: string, itemId: string) => void;
}

const Column: React.FC<IColumn> = (props) => {
    const [filterDialogIsOpen, setFilterDialogIsOpen] = useState(false);
    const [initialFilterSelectedItemIndex, setInitialFilterSelectedItemIndex] = useState(0);
    const [selectedTag, setSelectedTag] = useState<ITag>();

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

    const handleShouldDisplayItem = (item: IDraggableItem) => {
        if (selectedTag === undefined) return true;

        // show uncategorized items
        if (selectedTag.id === 'fordemopurposesonly') {
            return item.exclusion === undefined && item.tags.length === 0;
        }

        if (selectedTag.isExclusion) {
            return item.exclusion !== undefined && item.exclusion.id === selectedTag.id;
        } else {
            return item.tags.length > 0 && item.tags.findIndex((x) => x.id === selectedTag.id) >= 0;
        }
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
                selectedItemIndex={initialFilterSelectedItemIndex}
                isOpen={filterDialogIsOpen}
                onCloseDialog={handleCloseFilterDialog}
                allExclusions={props.tags.filter((x) => x.isExclusion)}
                allTags={props.tags.filter((x) => !x.isExclusion)}
                columnId={props.columnId}
                onCreateTag={props.onCreateTag}
                onSetItem={props.onSetItem}
                items={props.items}
                onInclude={props.onInclude}
            />

            <Paper elevation={0} sx={{ width: '100%' }}>
                <NeurosynthAutocomplete
                    noOptionsText="No tags"
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option?.id}>
                            <ListItemText
                                sx={{ color: option.isExclusion ? 'error.dark' : '' }}
                                primary={option?.label || ''}
                            />
                        </ListItem>
                    )}
                    value={selectedTag}
                    label="filter"
                    size="small"
                    options={[
                        ...props.tags,
                        { label: 'untagged', id: 'fordemopurposesonly', isExclusion: false },
                    ]}
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
                                isVisible={handleShouldDisplayItem(item)}
                                onSelectItem={handleSelectItem}
                                onCreateTag={props.onCreateTag}
                                allExclusions={props.tags.filter((x) => x.isExclusion)}
                                allInfoTags={props.tags.filter((x) => !x.isExclusion)}
                                onSetItem={(item) => props.onSetItem(props.columnId, item)}
                                key={item.id}
                                index={index}
                                item={item}
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
