import type { RowData } from '@tanstack/react-table';
import type { EAIExtractors } from 'hooks/extractions/useGetAllExtractedDataForStudies';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        columnLabel?: string;
        filterVariant?: 'text' | 'numeric' | 'status-select' | 'journal-autocomplete' | 'autocomplete';
        curatorTableColumnAIExtractor?: EAIExtractors;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        curatorTableOnRemoveColumn?: (column: string) => void;
        curatorTableOnAddColumn?: (column: string) => void;
    }
}

export {};
