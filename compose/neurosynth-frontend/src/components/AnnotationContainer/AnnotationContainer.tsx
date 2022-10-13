import { DragDropContext, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import React, { useEffect, useState } from 'react';
import Column from './Column/Column';
import { IDraggableItem } from './DraggableItem/DraggableItem';

export interface IAnnotationContainer {
    columnTitle: string;
    columnId: string;
    itemList: IDraggableItem[];
}

const AnnotationContainer: React.FC<{ data: IAnnotationContainer[] }> = (props) => {
    const [data, setData] = useState<IAnnotationContainer[]>();

    useEffect(() => {
        if (props.data) {
            setData(props.data);
        }
    }, [props.data]);

    const [tags, setTags] = useState<{ label: string; id: string }[]>([
        {
            label: 'Duplicates',
            id: 'DKvyYv93jI',
        },
        {
            label: 'Insufficient detail',
            id: 'JLSYm7Cs8O',
        },
    ]);

    const handleClickAddColumn = (event: React.MouseEvent) => {
        setData((prev) => {
            if (!prev) return [];
            const updatedColumns = [...prev];
            updatedColumns.push({
                columnTitle: 'New Column',
                columnId: Math.random().toString(36).substr(2, 5),
                itemList: [],
            });

            return updatedColumns;
        });
    };

    const handleDeleteTag = (colId: string, id: string) => {
        setData((prev) => {
            if (!prev) return [];
            const colIndex = prev.findIndex((x) => x.columnId === colId);
            if (colIndex < 0) return prev;

            const updatedCol = { ...prev[colIndex] };
            const itemIndex = updatedCol.itemList.findIndex((x) => x.id === id);
            if (itemIndex < 0) return prev;

            updatedCol.itemList[itemIndex] = {
                ...updatedCol.itemList[itemIndex],
                tag: undefined,
            };

            const updatedState = [...prev];
            updatedState[colIndex] = updatedCol;

            return updatedState;
        });
    };

    const handleCreateTag = (tagName: string) => {
        const newTag = {
            label: tagName,
            id: Math.random().toString(36).substr(2, 5),
        };
        setTags((prev) => {
            if (!prev) return [];

            const updatedTagList = [...prev, newTag];

            return updatedTagList;
        });

        return newTag;
    };

    const handleAddTag = (
        columnId: string,
        itemId: string,
        receivedTag: { label: string; id: string }
    ) => {
        setData((prev) => {
            if (!prev) return [];
            const colIndex = prev.findIndex((x) => x.columnId === columnId);
            if (colIndex < 0) return prev;

            const updatedCol = { ...prev[colIndex] };
            const itemIndex = updatedCol.itemList.findIndex((x) => x.id === itemId);
            if (itemIndex < 0) return prev;

            updatedCol.itemList[itemIndex] = {
                ...updatedCol.itemList[itemIndex],
                tag: { ...receivedTag },
            };

            const updatedState = [...prev];
            updatedState[colIndex] = updatedCol;

            return updatedState;
        });
    };

    const handleDragEnd = (result: DropResult, provided: ResponderProvided) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index)
            return;

        if (source.droppableId === destination.droppableId) {
            setData((prev) => {
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
                return updatedState;
            });
        } else {
            setData((prev) => {
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

                return updatedState;
            });
        }
    };

    const handleUpdateItems = (colId: string, items: IDraggableItem[]) => {
        setData((prev) => {
            if (!prev) return prev;
            const updatedCols = [...prev];

            const colIndex = updatedCols.findIndex((x) => x.columnId === colId);
            if (colIndex < 0) return prev;

            updatedCols[colIndex].itemList = [...items];

            return updatedCols;
        });
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Box sx={{ marginBottom: '1.5rem' }}>
                <Button color="primary" variant="outlined" onClick={handleClickAddColumn}>
                    add column
                </Button>
            </Box>
            <Box sx={{ display: 'flex', width: '100%' }}>
                {(data || []).map((column, index) => (
                    <Column
                        onUpdateItems={handleUpdateItems}
                        onCreateTag={handleCreateTag}
                        onAddTag={handleAddTag}
                        onDeleteTag={handleDeleteTag}
                        key={column.columnId}
                        columnId={column.columnId}
                        columnTitle={column.columnTitle}
                        items={column.itemList}
                        tags={tags}
                    />
                ))}
            </Box>
        </DragDropContext>
    );
};

export default AnnotationContainer;
