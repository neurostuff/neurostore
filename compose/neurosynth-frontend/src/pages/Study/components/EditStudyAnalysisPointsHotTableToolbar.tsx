import { Add, Delete, TableRows } from '@mui/icons-material';
import { Box, Button, ButtonGroup, Tooltip } from '@mui/material';
import React from 'react';

const EditStudyAnalysisPointsHotTableToolbar: React.FC<{
    onAddRow: () => void;
    onAddRows: () => void;
    onDeleteRows: () => void;
}> = React.memo(({ onAddRow, onAddRows, onDeleteRows }) => {
    return (
        <Box sx={{ borderRadius: '8px', width: '100%' }}>
            <ButtonGroup orientation="vertical" sx={{ width: '40px' }}>
                <Tooltip title="Add row" placement="right">
                    <Button onClick={onAddRow} color="primary" sx={{ height: '40px' }}>
                        <Add fontSize="small" />
                    </Button>
                </Tooltip>
                <Tooltip title="Add rows" placement="right">
                    <Button onClick={onAddRows} sx={{ height: '40px' }} color="primary">
                        <Add sx={{ fontSize: '18px' }} />
                        <TableRows sx={{ fontSize: '12px' }} />
                    </Button>
                </Tooltip>
                <Tooltip title="Delete row" placement="right">
                    <Button onClick={onDeleteRows} sx={{ height: '40px' }} color="error">
                        <Delete sx={{ fontSize: '20px' }} />
                    </Button>
                </Tooltip>
            </ButtonGroup>
        </Box>
    );
});

export default EditStudyAnalysisPointsHotTableToolbar;
