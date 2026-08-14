import type { RowData } from '@tanstack/react-table';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import useIbmaBoardMutations from './useIbmaBoardMutations';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        selectedImageId?: string | null;
        analyses?: AnalysisReturnNested[];
        toggleImageSelection?: (imageId?: string) => void;
        updateImage?: ReturnType<typeof useIbmaBoardMutations>['updateImage'];
        createAnalysis?: ReturnType<typeof useIbmaBoardMutations>['createAnalysis'];
        addAnnotationColumn?: ReturnType<typeof useIbmaBoardMutations>['addAnnotationColumn'];
        deleteAnalysis?: ReturnType<typeof useIbmaBoardMutations>['deleteAnalysis'];
        updateAnalysis?: ReturnType<typeof useIbmaBoardMutations>['updateAnalysis'];
        updateAnnotationCell?: ReturnType<typeof useIbmaBoardMutations>['updateAnnotationCell'];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        editStudyAnalysisTableNoteKey?: NoteKeyType;
    }
}

export {};
