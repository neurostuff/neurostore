import { Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { DragDropContext, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import CurationColumn, { ICurationColumn } from '../CurationColumn/CurationColumn';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import CurationBoardStyles from './CurationBoard.styles';
import { useEffect, useState } from 'react';

const CurationBoard: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { data } = useGetProjectById(projectId);
    const { mutate } = useUpdateProject();
    const [curationColumns, setCurationColumns] = useState<ICurationColumn[]>([]);
    const [initialLoad, setInitialLoad] = useState(false);

    useEffect(() => {
        if (data?.provenance?.curationMetadata?.columns && !initialLoad) {
            console.log(initialLoad);
            setInitialLoad(true);
            setCurationColumns(data.provenance.curationMetadata.columns || []);
        }
    }, [data, initialLoad]);

    useEffect(() => {
        const debounceTimeout = setTimeout(() => {
            console.log('curation columns changed');
        }, 5000);

        return () => {
            clearTimeout(debounceTimeout);
        };
    }, [curationColumns]);

    const handleDragEnd = (result: DropResult, provided: ResponderProvided) => {
        const { destination, source, draggableId } = result;

        if (projectId && data?.provenance?.curationMetadata?.columns && curationColumns) {
            // don't do anything if not dropped to a valid destination, or if the draggable was not moved
            if (
                !destination ||
                (destination.droppableId === source.droppableId &&
                    destination.index === source.index)
            ) {
                return;
            }

            const columnsUpdate = [...curationColumns];

            // drop item in the same column but different place
            if (source.droppableId === destination.droppableId) {
                const colIndex = columnsUpdate.findIndex((col) => col.id === source.droppableId);
                if (colIndex < 0) return;

                const updatedStubStudiesList = [...columnsUpdate[colIndex].stubStudies];
                const draggable = updatedStubStudiesList[source.index];
                updatedStubStudiesList.splice(source.index, 1);
                updatedStubStudiesList.splice(destination.index, 0, draggable);
                const columnUpdate = {
                    ...columnsUpdate[colIndex],
                    stubStudies: updatedStubStudiesList,
                };

                columnsUpdate[colIndex] = columnUpdate;
            } else {
                // drop item in a different column
                const startColIndex = columnsUpdate.findIndex(
                    (col) => col.id === source.droppableId
                );
                const endColIndex = columnsUpdate.findIndex(
                    (col) => col.id === destination.droppableId
                );

                if (startColIndex < 0 || endColIndex < 0) return;

                const updatedStartColStubStudiesList = [
                    ...columnsUpdate[startColIndex].stubStudies,
                ];
                const draggable = updatedStartColStubStudiesList[source.index];
                updatedStartColStubStudiesList.splice(source.index, 1);
                const updatedStartCol = {
                    ...columnsUpdate[startColIndex],
                    stubStudies: updatedStartColStubStudiesList,
                };

                const updatedEndColStubStudiesList = [...columnsUpdate[endColIndex].stubStudies];
                updatedEndColStubStudiesList.splice(destination.index, 0, draggable);
                const updatedEndCol = {
                    ...columnsUpdate[endColIndex],
                    stubStudies: updatedEndColStubStudiesList,
                };

                columnsUpdate[startColIndex] = updatedStartCol;
                columnsUpdate[endColIndex] = updatedEndCol;
            }

            // store this in local memory so that we don't get weird behavior and lag when updating via HTTP
            setCurationColumns(columnsUpdate);

            // mutate({
            //     projectId: projectId,
            //     project: {
            //         provenance: {
            //             ...data.provenance,
            //             curationMetadata: {
            //                 ...data.provenance.curationMetadata,
            //                 columns: columnsUpdate,
            //             },
            //         },
            //     },
            // });
        }
    };

    return (
        <Box sx={{ height: '100%' }}>
            <DragDropContext onDragEnd={handleDragEnd}>
                <Box sx={CurationBoardStyles.columnContainer}>
                    {curationColumns.map((column, index) => (
                        <CurationColumn key={column.id} {...column} columnIndex={index} />
                    ))}
                </Box>
            </DragDropContext>
        </Box>
    );
};

export default CurationBoard;
