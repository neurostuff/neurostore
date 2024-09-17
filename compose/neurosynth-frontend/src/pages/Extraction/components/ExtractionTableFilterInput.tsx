import { Box, TextField } from '@mui/material';
import { Column } from '@tanstack/react-table';
import { ChangeEvent, useCallback } from 'react';
import { EExtractionStatus } from '../ExtractionPage';
import { IExtractionTableStudy } from './ExtractionTable';
import ExtractionTableJournalAutocomplete from './ExtractionTableJournalAutocomplete';
import ExtractionTableStatusFilter from './ExtractionTableStatusFilter';
import DebouncedTextField from 'components/DebouncedTextField';

const ExtractionTableFilterInput: React.FC<{ column: Column<IExtractionTableStudy, unknown> }> = ({
    column,
}) => {
    const columnFilterValue = column.getFilterValue();
    const { filterVariant } = column.columnDef.meta ?? {};

    const handleChangeText = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            column.setFilterValue(event.target.value);
        },
        [column]
    );

    const handleChangeAutocomplete = useCallback(
        (event: string | null | undefined) => {
            column.setFilterValue(event ?? null);
        },
        [column]
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
