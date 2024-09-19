import { Box } from '@mui/material';
import { Column, Table } from '@tanstack/react-table';
import DebouncedTextField from 'components/DebouncedTextField';
import { useCallback } from 'react';
import { EExtractionStatus } from '../ExtractionPage';
import { IExtractionTableStudy } from './ExtractionTable';
import ExtractionTableJournalAutocomplete from './ExtractionTableJournalAutocomplete';
import ExtractionTableStatusFilter from './ExtractionTableStatusFilter';

const ExtractionTableFilterInput: React.FC<{
    table: Table<IExtractionTableStudy>;
    column: Column<IExtractionTableStudy, unknown>;
}> = ({ table, column }) => {
    const columnFilterValue = column.getFilterValue();
    const { filterVariant } = column.columnDef.meta ?? {};

    const handleChangeAutocomplete = useCallback(
        (event: string | null | undefined) => {
            table.resetPageIndex();
            column.setFilterValue(event ?? null);
        },
        [column, table]
    );

    if (filterVariant === 'status-select') {
        return (
            <ExtractionTableStatusFilter
                value={columnFilterValue as EExtractionStatus}
                onChange={handleChangeAutocomplete}
            />
        );
    } else if (filterVariant === 'journal-autocomplete') {
        return (
            <ExtractionTableJournalAutocomplete
                value={columnFilterValue as string}
                onChange={handleChangeAutocomplete}
            />
        );
    } else {
        return (
            <Box sx={{ marginTop: '4px' }}>
                <DebouncedTextField
                    size="small"
                    placeholder="filter by..."
                    sx={{ width: '100%' }}
                    onChange={handleChangeAutocomplete}
                    value={columnFilterValue as string}
                />
            </Box>
        );
    }
};

export default ExtractionTableFilterInput;
