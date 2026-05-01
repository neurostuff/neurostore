import { AxiosError, AxiosResponse } from 'axios';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import {
    AnnotationRequestOneOf,
    AnnotationReturn,
    AnnotationReturnOneOf,
    NoteCollectionRequest,
    NoteCollectionReturn,
} from 'neurostore-typescript-sdk';
import { UseMutateFunction } from 'react-query';

/** Matches `useUpdateAnnotationById` mutateAsync (annotationsIdPut). */
export type UpdateAnnotationsMutateAsync = (variables: {
    argAnnotationId: string;
    annotation: AnnotationRequestOneOf;
}) => Promise<AxiosResponse<AnnotationReturn>>;

/** Matches `useUpdateAnnotationByAnnotationAndAnalysisId` mutateAsync (annotationAnalysesPost). */
export type UpdateAnnotationAnalysesMutateAsync = (
    variables: NoteCollectionRequest[]
) => Promise<AxiosResponse<NoteCollectionReturn[]>>;

export type AnnotationStoreMetadata = {
    annotationIsEdited: boolean;
    noteKeysHaveChanged: boolean;
    getAnnotationIsLoading: boolean;
    updateAnnotationIsLoading: boolean;
    isError: boolean; // fetch + update mutations
    updateAnnotations:
        | UseMutateFunction<
              AxiosResponse<AnnotationReturn>,
              AxiosError,
              { argAnnotationId: string; annotation: AnnotationRequestOneOf },
              unknown
          >
        | undefined;
    updateAnnotationAnalyses:
        | UseMutateFunction<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>
        | undefined;
};

export interface IStoreNoteCollectionReturn extends NoteCollectionReturn {
    isNew?: boolean;
    isEdited?: boolean;
}

export interface IStoreAnnotation extends Omit<AnnotationReturnOneOf, 'notes' | 'note_keys'> {
    notes: IStoreNoteCollectionReturn[] | undefined;
    note_keys: NoteKeyType[] | undefined;
}

export type AnnotationStoreActions = {
    initAnnotationStore: (annotation: AnnotationReturnOneOf | undefined) => void;
    setAnnotationIsEdited: (isEdited: boolean) => void;
    clearAnnotationStore: () => void;
    updateNotes: (updatedNotes: Array<NoteCollectionReturn>) => void;
    createAnnotationColumn: (noteKey: Omit<NoteKeyType, 'order'>) => void;
    updateAnnotationInDB: () => Promise<void>;
    createAnnotationNote: (analysisId: string, studyId: string, analysisName: string) => void;
    deleteAnnotationNote: (analysisId: string) => void;
    removeAnnotationColumn: (noteKey: string) => void;
    updateAnnotationNoteDetails: (note: Partial<IStoreNoteCollectionReturn>) => void;
    updateAnnotationMetadata: (metadata: Partial<AnnotationStoreMetadata>) => void;
};

export type AnnotationNoteType = {
    [key: string]: string | boolean | number | null;
};
