import { Autocomplete, Box, Chip, ListItem, ListItemText, TextField } from '@mui/material';
import { AccessorFn, Row } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { flattenColumnValues } from '../hooks/useCuratorTableState.helpers';
import { ICurationTableColumnType, ICurationTableStudy } from '../hooks/useCuratorTableState.types';

const CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete: React.FC<{
    rows: Row<ICurationTableStudy>[];
    accessorFn: AccessorFn<ICurationTableStudy, ICurationTableColumnType> | undefined;
    value: string[] | undefined;
    onChange: (newVal: string[] | undefined) => void;
}> = ({ rows, onChange, value, accessorFn }) => {
    const [inputValue, setInputValue] = useState('');

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
        <Box>
            <Autocomplete
                size="small"
                open
                blurOnSelect={false}
                clearOnBlur={false}
                clearOnEscape={false}
                renderInput={(params) => (
                    <TextField {...params} sx={{ width: '200px', input: { fontSize: '12px' } }} placeholder="filter" />
                )}
                onChange={(_event, value) => {
                    onChange(value.length === 0 ? undefined : value);
                }}
                value={value || []}
                inputValue={inputValue}
                onInputChange={(event, value, reason) => {
                    if (event && event.type === 'blur') {
                        setInputValue('');
                    } else if (reason !== 'reset') {
                        setInputValue(value);
                    }
                }}
                options={uniqueValuesForColumn}
                multiple
                slotProps={{
                    popper: { disablePortal: true },
                    paper: { sx: { fontSize: '12px' } },
                }}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip label={option} sx={{ fontSize: '12px' }} size="small" {...getTagProps({ index })} />
                    ))
                }
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
