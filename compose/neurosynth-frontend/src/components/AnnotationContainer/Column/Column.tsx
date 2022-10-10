import { Droppable } from '@hello-pangea/dnd';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DraggableItem, { IDraggableItem } from '../DraggableItem/DraggableItem';
import IconButton from '@mui/material/IconButton';

interface IColumn {
    items: IDraggableItem[];
    columnId: string;
    columnTitle: string;
    onDeleteTag: (colId: string, id: string) => void;
    onAddTag: (columnId: string, itemId: string, tag: { id: string; label: string }) => void;
    onCreateTag: (columnId: string, itemId: string, tag: string) => void;
    tags: { label: string; id: string }[];
}

const Column: React.FC<IColumn> = (props) => {
    const handleAddTag = (itemId: string, tag: { id: string; label: string }) => {
        props.onAddTag(props.columnId, itemId, tag);
    };

    const handleCreateTag = (itemId: string, tagName: string) => {
        props.onCreateTag(props.columnId, itemId, tagName);
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
            <Typography variant="body1" sx={{ padding: '8px', color: 'rgb(94, 108, 132)' }}>
                {props.columnTitle} {props.items.length}
            </Typography>
            <Box sx={{ width: '100%' }}>
                <TextField sx={{ width: '100%' }} label="filter by tag" size="small" />
            </Box>
            <Divider sx={{ margin: '1rem 0' }} />
            {props.items.length === 0 && (
                <Typography sx={{ marginBottom: '0.5rem' }} color="warning.dark">
                    No studies
                </Typography>
            )}
            <Droppable droppableId={props.columnId}>
                {(provided) => (
                    <Box
                        sx={{ maxHeight: '600px', overflowY: 'auto', flexGrow: 1 }}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {props.items.map((item, index) => (
                            <DraggableItem
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
