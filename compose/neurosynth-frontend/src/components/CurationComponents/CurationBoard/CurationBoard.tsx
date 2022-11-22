import { Box, IconButton, Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { DragDropContext, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import CurationColumn from '../CurationColumn/CurationColumn';

const CurationBoard: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { data } = useGetProjectById(projectId);

    const handleDragEnd = (result: DropResult, provided: ResponderProvided) => {};

    return (
        <StateHandlerComponent isLoading={false} isError={false}>
            <Box sx={{ display: 'flex' }}>
                <Typography gutterBottom variant="h4">
                    Curation Board
                </Typography>
                <Box>
                    <IconButton onClick={() => {}} color="primary">
                        <HelpIcon />
                    </IconButton>
                </Box>
            </Box>
            <Box>
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Box
                        sx={{
                            width: '100%',
                            overflowY: 'auto',
                            display: 'flex',
                        }}
                    >
                        {(data?.provenance?.curationMetadata?.columns || []).map((column) => (
                            <CurationColumn key={column.id} {...column} />
                        ))}
                    </Box>
                </DragDropContext>
            </Box>
        </StateHandlerComponent>
    );
};

export default CurationBoard;
