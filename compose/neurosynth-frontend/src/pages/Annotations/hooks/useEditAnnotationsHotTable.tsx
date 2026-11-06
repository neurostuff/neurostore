import { useAuth0 } from '@auth0/auth0-react';
import { createColWidths, noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import { ColumnSettings } from 'handsontable/settings';
import { useGetAnnotationById } from 'hooks';
import { useEffect, useMemo, useState } from 'react';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import {
    annotationNotesToHotData,
    createColumnHeaders,
    getMergeCells,
    createColumns,
    getRowHeights,
    MergeCellRange,
} from 'pages/Annotations/components/EditAnnotationsHotTable.helpers';

export type EditAnnotationsHotSnapshot = {
    annotationId: string;
    hotData: AnnotationNoteValue[][];
    hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string; isEdited: boolean }>;
    noteKeys: NoteKeyType[];
    hotColumns: ColumnSettings[];
    hotColumnHeaders: string[];
    colWidths: number[];
    rowHeights: number[];
    mergeCells: MergeCellRange[];
};

/**
 * Builds the initial table data once per annotation id. Later react-query updates for the same annotation
 * (e.g. the refetch after saving) do not replace the snapshot, because Handsontable owns the edits.
 */
const useEditAnnotationsHotTable = (annotationId?: string) => {
    const { data: annotations } = useGetAnnotationById(annotationId);
    const { user } = useAuth0();
    const [snapshot, setSnapshot] = useState<EditAnnotationsHotSnapshot>();

    useEffect(() => {
        if (!annotations?.id) return;
        const loadedAnnotationId = annotations.id;

        setSnapshot((prev) => {
            if (prev?.annotationId === loadedAnnotationId) return prev;

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
            const mergeCells = getMergeCells(hotDataToStudyMapping);

            return {
                annotationId: loadedAnnotationId,
                hotData,
                hotDataToStudyMapping,
                noteKeys,
                hotColumns: createColumns(noteKeys),
                hotColumnHeaders: createColumnHeaders(noteKeys),
                colWidths: createColWidths(noteKeys, 300, 150, 150),
                rowHeights: getRowHeights(hotData, mergeCells, 300),
                mergeCells,
            };
        });
    }, [annotations]);

    const theUserOwnsThisAnnotation = useMemo(() => {
        return (user?.sub || null) === (annotations?.user || undefined);
    }, [user?.sub, annotations?.user]);

    return {
        theUserOwnsThisAnnotation,
        snapshot,
    };
};

export default useEditAnnotationsHotTable;
