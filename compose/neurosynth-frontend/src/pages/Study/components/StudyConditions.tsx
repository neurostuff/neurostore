import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { ConditionReturn } from 'neurostore-typescript-sdk';

const ROW_HEIGHT = 58;

const StudyConditions: React.FC<{ conditions: ConditionReturn[]; weights: number[] }> = (props) => {
    const conditionRows = ((props?.conditions as ConditionReturn[]) || []).map((condition, index) => ({
        id: condition.id,
        condition: condition.name,
        weight: (props?.weights || [])[index],
    }));

    return (
        <Box sx={{ marginTop: '1rem' }}>
            <Typography sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }} gutterBottom>
                Conditions
            </Typography>
            <Box
                sx={{
                    height: ROW_HEIGHT * (conditionRows.length === 0 ? 1 : conditionRows.length) + ROW_HEIGHT,
                }}
            >
                <DataGrid
                    disableColumnSelector
                    hideFooter
                    disableSelectionOnClick
                    showCellRightBorder
                    rowHeight={ROW_HEIGHT}
                    columns={[
                        {
                            field: 'condition',
                            headerAlign: 'left',
                            align: 'left',
                            headerName: 'Condition',
                            editable: false,
                            flex: 1,
                            type: 'string',
                        },
                        {
                            field: 'weight',
                            headerAlign: 'left',
                            align: 'left',
                            headerName: 'Weight',
                            editable: false,
                            flex: 1,
                            type: 'number',
                        },
                    ]}
                    rows={conditionRows}
                />
            </Box>
        </Box>
    );
};

export default StudyConditions;
