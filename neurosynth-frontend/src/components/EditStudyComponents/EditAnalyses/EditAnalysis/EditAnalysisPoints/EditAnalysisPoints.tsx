import { Button, TextField, Divider } from '@mui/material';
import { Box } from '@mui/system';
import React, { ChangeEvent, useState } from 'react';
import { IEditAnalysisPoints } from '../..';
import EditAnalysisPointsStyles from './EditAnalysisPoints.styles';
import EditAnalysisPointsRow from './EditAnalysisPointsRow/EditAnalysisPointsRow';

const EditAnalysisPoints: React.FC<IEditAnalysisPoints> = (props) => {
    const [editCoordinates, setEditCoordinates] = useState({
        x: 0,
        y: 0,
        z: 0,
    });

    const handleOnChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const newValue = parseInt(event.target.value);
        if (!isNaN(newValue)) {
            setEditCoordinates((prevState) => ({
                ...prevState,
                [event.target.name]: newValue,
            }));
        }
    };

    const handleOnAdd = (event: React.MouseEvent) => {
        props.onAddPoint(editCoordinates);
    };

    const hasPoints = props.points && props.points.length > 0;

    return (
        <Box>This has not yet been implemented yet. Please check back later</Box>
        // <Box
        //     component="div"
        //     sx={{
        //         display: 'flex',
        //         flexDirection: 'column',
        //         alignItems: 'center',
        //         width: '100%',
        //         maxHeight: {
        //             xs: '200px',
        //             md: '350px',
        //         },
        //         overflow: 'auto',
        //         marginBottom: '15px',
        //     }}
        // >
        //     <Box sx={{ width: '60%' }}>
        //         <Box
        //             sx={{
        //                 width: '100%',
        //                 display: 'flex',
        //                 marginTop: '5px',
        //                 justifyContent: 'space-evenly',
        //             }}
        //         >
        //             <TextField
        //                 type="number"
        //                 value={editCoordinates.x}
        //                 onChange={handleOnChange}
        //                 sx={EditAnalysisPointsStyles.textfield}
        //                 name="x"
        //                 label="X Coordinate"
        //             />
        //             <TextField
        //                 type="number"
        //                 value={editCoordinates.y}
        //                 onChange={handleOnChange}
        //                 sx={EditAnalysisPointsStyles.textfield}
        //                 name="y"
        //                 label="Y Coordinate"
        //             />
        //             <TextField
        //                 type="number"
        //                 value={editCoordinates.z}
        //                 onChange={handleOnChange}
        //                 sx={EditAnalysisPointsStyles.textfield}
        //                 name="z"
        //                 label="Z Coordinate"
        //             />
        //             <Button onClick={handleOnAdd} color="primary">
        //                 Add
        //             </Button>
        //         </Box>
        //         <Divider sx={{ margin: '20px 0' }} />
        //         <Box>
        //             {!hasPoints && (
        //                 <Box component="span" sx={{ color: 'warning.dark' }}>
        //                     No coordinates
        //                 </Box>
        //             )}
        //             {hasPoints &&
        //                 props.points?.map((point) => <EditAnalysisPointsRow {...point} />)}
        //         </Box>
        //     </Box>
        // </Box>
    );
};

export default EditAnalysisPoints;
