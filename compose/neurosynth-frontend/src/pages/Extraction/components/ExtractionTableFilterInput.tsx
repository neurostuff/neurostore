import { Autocomplete, Box, Input, TextField } from '@mui/material';
import { Column } from '@tanstack/react-table';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useCallback } from 'react';

const ExtractionTableFilterInput: React.FC<{ column: Column<StudyReturn, unknown> }> = ({
    column,
}) => {
    const columnFilterValue = column.getFilterValue();
    const { filterVariant } = column.columnDef.meta ?? {};

    const handleChange = useCallback(
        (_event: any, newVal: string | null, _reason: any) => {
            // column.setFilterValue()
        },
        [column]
    );

    if (filterVariant === 'status-select') {
        return <Box>Status Select</Box>;
    } else if (filterVariant === 'journal-autocomplete') {
        return (
            <Box>
                <Autocomplete
                    size="small"
                    renderInput={(params) => <TextField {...params} />}
                    onChange={handleChange}
                    value={String(columnFilterValue)}
                    options={[]}
                />
            </Box>
        );
    } else {
        return (
            <Box>
                <TextField size="small" sx={{ width: '100%' }} />
            </Box>
        );
    }
};

export default ExtractionTableFilterInput;
