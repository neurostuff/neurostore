import { Box } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { DragDropContext, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import CurationColumn from '../CurationColumn/CurationColumn';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import CurationBoardStyles from './CurationBoard.styles';

const CurationBoard: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { data } = useGetProjectById(projectId);
    const { mutate } = useUpdateProject();

    const handleDragEnd = (result: DropResult, provided: ResponderProvided) => {
        if (!data?.provenance?.curationMetadata?.columns) return;
        if (!projectId) return;
        const { destination, source, draggableId } = result;
        if (
            !destination ||
            (destination.droppableId === source.droppableId && destination.index === source.index)
        ) {
            return;
        }

        const prevColumns = data.provenance.curationMetadata.columns;

        // drop item in the same column but different place
        if (source.droppableId === destination.droppableId) {
            const colIndex = prevColumns.findIndex((col) => col.id === source.droppableId);
            if (colIndex < 0) return;

            const columnUpdate = { ...prevColumns[colIndex] };
            const updatedStubStudiesList = [...columnUpdate.stubStudies];
            const updatedSource = updatedStubStudiesList[source.index];
            updatedStubStudiesList.splice(source.index, 1);
            updatedStubStudiesList.splice(destination.index, 0, updatedSource);
            columnUpdate.stubStudies = updatedStubStudiesList;

            prevColumns[colIndex] = columnUpdate;
        } else {
            // drop item in a different column
            const startColIndex = prevColumns.findIndex((col) => col.id === source.droppableId);
            const endColIndex = prevColumns.findIndex((col) => col.id === destination.droppableId);

            if (startColIndex < 0 || endColIndex < 0) return;

            const updatedStartCol = { ...prevColumns[startColIndex] };
            const updatedSource = { ...updatedStartCol.stubStudies[source.index] };
            const updatedStartColStubStudiesList = [...updatedStartCol.stubStudies];
            updatedStartColStubStudiesList.splice(source.index, 1);
            updatedStartCol.stubStudies = updatedStartColStubStudiesList;

            const updatedEndCol = { ...prevColumns[endColIndex] };
            const updatedEndColStubStudiesList = [...updatedEndCol.stubStudies];
            updatedEndColStubStudiesList.splice(destination.index, 0, { ...updatedSource });
            updatedEndCol.stubStudies = updatedEndColStubStudiesList;

            prevColumns[startColIndex] = updatedStartCol;
            prevColumns[endColIndex] = updatedEndCol;
        }

        mutate({
            projectId: projectId,
            project: {
                provenance: {
                    ...data.provenance,
                    curationMetadata: {
                        ...data.provenance.curationMetadata,
                        columns: prevColumns,
                    },
                },
            },
        });
    };

    return (
        <Box sx={{ height: '100%' }}>
            <DragDropContext onDragEnd={handleDragEnd}>
                <Box sx={CurationBoardStyles.columnContainer}>
                    {(data?.provenance?.curationMetadata?.columns || []).map((column) => (
                        <CurationColumn key={column.id} {...column} />
                    ))}
                </Box>
            </DragDropContext>
        </Box>
    );
};

export default CurationBoard;
