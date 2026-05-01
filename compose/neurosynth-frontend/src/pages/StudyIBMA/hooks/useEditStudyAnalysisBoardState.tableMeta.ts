import type { RowData } from '@tanstack/react-table';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        selectedImageId?: string | null;
        toggleImageSelection?: (imageId: string) => void;
        removeImageFromAnalysis?: (analysisId: string, image: ImageReturn) => void;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        editStudyAnalysisTableNoteKey?: NoteKeyType;
    }
}

export {};
