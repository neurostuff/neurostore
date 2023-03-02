import { Box } from '@mui/material';
import { DragDropContext } from '@hello-pangea/dnd';
import CurationColumn from '../CurationColumn/CurationColumn';
import CurationBoardStyles from './CurationBoard.styles';
import {
    useHandleCurationDrag,
    useProjectNumCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';

const CurationBoard: React.FC = (props) => {
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

export default CurationBoard;
