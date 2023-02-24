import { Box } from '@mui/material';
import { DragDropContext } from '@hello-pangea/dnd';
import CurationColumn from '../CurationColumn/CurationColumn';
import CurationBoardStyles from './CurationBoard.styles';
import {
    useHandleCurationDrag,
    useProjectCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';

const CurationBoard: React.FC = (props) => {
    const handleDrag = useHandleCurationDrag();
    const curationColumns = useProjectCurationColumns();

    return (
        <Box sx={{ height: '100%' }}>
            <DragDropContext onDragEnd={handleDrag}>
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
