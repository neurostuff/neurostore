import { Autocomplete, Box, ListItem, ListItemText, TextField } from '@mui/material';
import { AccessorFn, Row } from '@tanstack/react-table';
import { useMemo } from 'react';
import { flattenColumnValues } from '../hooks/useCuratorTableState.helpers';
import { ICurationTableColumnType, ICurationTableStudy } from '../hooks/useCuratorTableState.types';

const CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete: React.FC<{
    rows: Row<ICurationTableStudy>[];
    accessorFn: AccessorFn<ICurationTableStudy, ICurationTableColumnType> | undefined;
    value: string[] | undefined;
    onChange: (newVal: string[] | undefined) => void;
}> = ({ rows, onChange, value, accessorFn }) => {
    // note that for this data, we only expect column data to be a string or an object
    const uniqueValuesForColumn = useMemo(() => {
        if (!accessorFn) return [];
        const valuesSet = new Set<string>();
        const allColumnValues = rows.map((r, index) => accessorFn(r.original, index)) as ICurationTableColumnType[];

        allColumnValues.forEach((columnValue) => {
            if (
                columnValue === null ||
                columnValue === undefined ||
                columnValue === 'null' ||
                columnValue === 'undefined' ||
                columnValue === ''
            ) {
                return;
            }
            const flattendValues = flattenColumnValues(columnValue, false);
            flattendValues.forEach((v) => valuesSet.add(v));
        });

        return Array.from(valuesSet);
    }, [accessorFn, rows]);

    return (
        <Box sx={{ padding: '0.5rem' }}>
            <Autocomplete
                size="small"
                renderInput={(params) => (
                    <TextField
                        {...params}
                        sx={{
                            width: '200px',
                            input: { fontSize: '12px' },
                        }}
                        placeholder="filter"
                    />
                )}
                onChange={(_event, value) => {
                    onChange(value.length === 0 ? undefined : value);
                }}
                value={value || []}
                options={uniqueValuesForColumn}
                multiple
                renderOption={(props, option) => (
                    <ListItem {...props} key={option}>
                        <ListItemText primary={option} primaryTypographyProps={{ fontSize: '12px' }} />
                    </ListItem>
                )}
            />
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete;
