import type { RowData } from '@tanstack/react-table';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { ImageRequest } from 'neurostore-typescript-sdk';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        selectedImageId?: string | null;
        toggleImageSelection?: (imageId: string) => void;
        updateImage?: (image: ImageRequest) => void;
        deleteAnalysis?: (analysisId: string) => void | Promise<void>;
        updateAnalysis?: (payload: { analysisId: string; name: string; description: string }) => void | Promise<void>;
        updateAnnotationCell?: (args: {
            analysisId: string;
            columnKey: string;
            value: string | boolean | number | null;
        }) => void | Promise<void>;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        editStudyAnalysisTableNoteKey?: NoteKeyType;
    }
}

export {};
