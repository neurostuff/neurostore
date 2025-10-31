import { useAuth0 } from '@auth0/auth0-react';
import { createColWidths, noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import { ColumnSettings } from 'handsontable/settings';
import { useGetAnnotationById } from 'hooks';
import { useEffect, useMemo, useState } from 'react';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import {
    annotationNotesToHotData,
    createColumnHeader,
    getMergeCells,
    createColumns,
    getRowHeights,
} from 'pages/Annotations/components/EditAnnotationsHotTable.helpers';

const useEditAnnotationsHotTable = (annotationId?: string, disableEdit?: boolean) => {
    const {
        data: annotations,
        isLoading: getAnnotationIsLoading,
        isError: getAnnotationIsError,
    } = useGetAnnotationById(annotationId);
    const { user } = useAuth0();
    const [annotationsHotState, setAnnotationsHotState] = useState<{
        hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>;
        noteKeys: NoteKeyType[];
        hotData: AnnotationNoteValue[][];
        hotColumns: ColumnSettings[];
        mergeCells: MergeCellsSettings[];
        isEdited: boolean;
    }>({
        hotDataToStudyMapping: new Map<number, { studyId: string; analysisId: string }>(),
        noteKeys: [],
        hotData: [],
        hotColumns: [],
        mergeCells: [],
        isEdited: false,
    });

    useEffect(() => {
        if (!annotations) return;

        const noteKeys = noteKeyObjToArr(annotations.note_keys);
        const { hotData, hotDataToStudyMapping } = annotationNotesToHotData(
            noteKeys,
            annotations.notes as NoteCollectionReturn[] | undefined,
            (annotationNote) => {
                const studyName =
                    annotationNote.study_name && annotationNote.study_year
                        ? `(${annotationNote.study_year}) ${annotationNote.study_name}`
                        : annotationNote.study_name
                          ? annotationNote.study_name
                          : '';

                const analysisName = annotationNote.analysis_name || '';

                return [studyName, analysisName];
            }
        );

        setAnnotationsHotState({
            hotDataToStudyMapping,
            noteKeys,
            hotColumns: createColumns(noteKeys, disableEdit),
            hotData: hotData,
            mergeCells: getMergeCells(hotDataToStudyMapping),
            isEdited: false,
        });
    }, [annotations, disableEdit]);

    const theUserOwnsThisAnnotation = useMemo(() => {
        return (user?.sub || null) === (annotations?.user || undefined);
    }, [user?.sub, annotations?.user]);

    const hotColumnHeaders = useMemo(() => {
        return [
            ...['Study', 'Analysis'],
            ...annotationsHotState.noteKeys.map((col) => {
                const allowRemoveColumn = col.key !== 'included';
                return createColumnHeader(col.key, col.type, allowRemoveColumn);
            }),
        ];
    }, [annotationsHotState.noteKeys]);

    const colWidths = useMemo(() => {
        return createColWidths(annotationsHotState.noteKeys, 300, 150, 200);
    }, [annotationsHotState.noteKeys]);

    const rowHeights = useMemo(() => {
        return getRowHeights(annotationsHotState.hotData, annotationsHotState.mergeCells, 300);
    }, [annotationsHotState.hotData, annotationsHotState.mergeCells]);

    return {
        theUserOwnsThisAnnotation,
        getAnnotationIsLoading,
        getAnnotationIsError,
        hotColumnHeaders,
        setAnnotationsHotState,
        colWidths,
        rowHeights,
        ...annotationsHotState,
    };
};

export default useEditAnnotationsHotTable;
