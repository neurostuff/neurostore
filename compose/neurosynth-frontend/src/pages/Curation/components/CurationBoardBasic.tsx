import { Box } from '@mui/material';
import { useHandleCurationDrag, useProjectNumCurationColumns } from 'pages/Project/store/ProjectStore';
import CurationColumn from './CurationColumn';
import CurationBoardStyles from './CurationBoard.styles';
import { DragDropContext } from '@hello-pangea/dnd';

const CurationBoardBasic: React.FC = () => {
    const handleDrag = useHandleCurationDrag();
    const numColumns = useProjectNumCurationColumns();
    const columnArr = [...Array(numColumns).keys()];

    return (
        <Box sx={{ height: '100%' }}>
            <DragDropContext onDragEnd={handleDrag}>
                <Box sx={CurationBoardStyles.columnContainer}>
                    {columnArr.map((column) => (
                        <CurationColumn key={column} columnIndex={column} />
                    ))}
                </Box>
            </DragDropContext>
        </Box>
    );
};

export default CurationBoardBasic;
