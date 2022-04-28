import { Box, TextField, Button } from '@mui/material';
import React, { useState } from 'react';
import { PointApiResponse } from '../../../../../../utils/api';
import EditAnalysisPointsRowStyles from './EditAnalysisPointsRow.styles';

const EditAnalysisPointsRow: React.FC<PointApiResponse> = (props) => {
    const [enableUpdate, setEnableUpdate] = useState(false);
    const handleDelete = (event: React.MouseEvent) => {};

    return (
        <Box
            component="div"
            sx={{ display: 'flex', justifyContent: 'space-evenly', marginBottom: '7px' }}
        >
            {props.coordinates ? (
                <>
                    <TextField
                        type="number"
                        value={props.coordinates[0]}
                        sx={EditAnalysisPointsRowStyles.textfield}
                    />
                    <TextField
                        type="number"
                        value={props.coordinates[1]}
                        sx={EditAnalysisPointsRowStyles.textfield}
                    />
                    <TextField
                        type="number"
                        value={props.coordinates[2]}
                        sx={EditAnalysisPointsRowStyles.textfield}
                    />
                    <Button onClick={handleDelete} color="error">
                        Delete
                    </Button>
                </>
            ) : (
                <Box sx={{ color: 'warning.dark' }}>No coordinate</Box>
            )}
        </Box>
    );
};

export default EditAnalysisPointsRow;
