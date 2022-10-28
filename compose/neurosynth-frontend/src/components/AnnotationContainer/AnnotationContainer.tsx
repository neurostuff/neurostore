import { DragDropContext, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import React from 'react';
import Column from './Column/Column';
import { IDraggableItem, ITag } from './DraggableItem/DraggableItem';

export interface IAnnotationContainer {
    columnTitle: string;
    columnId: string;
    itemList: IDraggableItem[];
}

const AnnotationContainer: React.FC<{
    data: IAnnotationContainer[];
    tags: ITag[];
    onSetItem: (colId: string, item: IDraggableItem) => void;
    onUpdateAnnotationContainer: (handleUpdateAnnotationContainer: IAnnotationContainer[]) => void;
    onCreateTag: (tagName: string, isExclusion: boolean) => ITag;
}> = (props) => {
    const handleDragEnd = (result: DropResult, provided: ResponderProvided) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index)
            return;

        if (source.droppableId === destination.droppableId) {
            const prev = props.data;
            if (!prev) return prev;
            const updatedState = [...prev];

            const colIndex = prev.findIndex((x) => x.columnId === source.droppableId);
            if (colIndex < 0) return prev;

            const updatedColumn = { ...prev[colIndex] };

            const updatedItems = [...updatedColumn.itemList];
            const updatedSource = { ...updatedItems[source.index] };
            updatedItems.splice(source.index, 1);
            updatedItems.splice(destination.index, 0, updatedSource);

            updatedState[colIndex] = updatedColumn;
            updatedColumn.itemList = updatedItems;
            props.onUpdateAnnotationContainer(updatedState);
        } else {
            const prev = props.data;
            if (!prev) return prev;
            const updatedState = [...prev];
            const startColIndex = prev.findIndex((x) => x.columnId === source.droppableId);
            const endColIndex = prev.findIndex((x) => x.columnId === destination.droppableId);

            if (startColIndex < 0 || endColIndex < 0) return prev;

            const updatedStartCol = { ...prev[startColIndex] };
            const updatedSource = { ...updatedStartCol.itemList[source.index] };
            const updatedStartColItems = [...updatedStartCol.itemList];
            updatedStartColItems.splice(source.index, 1);
            updatedStartCol.itemList = updatedStartColItems;

            const updatedEndCol = { ...prev[endColIndex] };
            const updatedEndColItems = [...updatedEndCol.itemList];
            updatedEndColItems.splice(destination.index, 0, { ...updatedSource });
            updatedEndCol.itemList = updatedEndColItems;

            updatedState[startColIndex] = updatedStartCol;
            updatedState[endColIndex] = updatedEndCol;

            props.onUpdateAnnotationContainer(updatedState);
        }
    };

    const handleInclude = (columnId: string, itemId: string) => {
        const updatedState = [...props.data];

        // check that source column id exists
        const sourceColumnIndex = props.data.findIndex((x) => x.columnId === columnId);
        if (sourceColumnIndex < 0) return;

        // check that we are not at the last column
        if (props.data[sourceColumnIndex + 1] === undefined) return;

        // check that item id exists within the source column
        const itemIndex = props.data[sourceColumnIndex].itemList.findIndex((x) => x.id === itemId);
        if (itemIndex < 0) return;

        const newItemList = [...props.data[sourceColumnIndex].itemList];
        const removedItem = newItemList.splice(itemIndex, 1);

        updatedState[sourceColumnIndex] = {
            ...props.data[sourceColumnIndex],
            itemList: newItemList,
        };

        updatedState[sourceColumnIndex + 1] = {
            ...props.data[sourceColumnIndex + 1],
            itemList: [{ ...removedItem[0] }, ...props.data[sourceColumnIndex + 1].itemList],
        };

        props.onUpdateAnnotationContainer(updatedState);
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Box sx={{ display: 'flex', width: '100%' }}>
                {(props.data || []).map((column) => (
                    <Column
                        key={column.columnId}
                        items={column.itemList}
                        columnId={column.columnId}
                        columnTitle={column.columnTitle}
                        onCreateTag={props.onCreateTag}
                        onSetItem={props.onSetItem}
                        tags={props.tags}
                        onInclude={handleInclude}
                    />
                ))}
            </Box>
        </DragDropContext>
    );
};

export default AnnotationContainer;
