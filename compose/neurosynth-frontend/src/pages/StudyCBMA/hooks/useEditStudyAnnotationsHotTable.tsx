import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import { useGetAnnotationById } from 'hooks';
import { useEffect, useState } from 'react';
import { createStudyAnnotationColumnSettings } from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.helpers';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.types';
import { useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';
import { useStudyAnalyses, useStudyId } from 'stores/study/StudyStore';

export type EditStudyAnnotationsHotSnapshot = IEditStudyAnnotationsDataRef & {
    annotationId: string;
    hotData: EditStudyAnnotationsNoteCollectionReturn[];
    noteKeys: NoteKeyType[];
    hiddenRows: number[];
};

/**
 * Builds the initial table data once per annotation id from the saved annotation, lined up with the study store's
 * analyses. Later refetches do not replace the snapshot, because Handsontable owns the edits until Save.
 */
const useEditStudyAnnotationsHotTable = (readonly?: boolean) => {
    const studyId = useStudyId();
    const analyses = useStudyAnalyses();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotation, isFetching } = useGetAnnotationById(annotationId);
    const [snapshot, setSnapshot] = useState<EditStudyAnnotationsHotSnapshot>();

    useEffect(() => {
        // a refetch still in flight after a save would seed stale values into other studies' rows,
        // and a later PUT would write those back
        if (!annotationId || !studyId || !annotation || isFetching) return;

        setSnapshot((prev) => {
            if (prev?.annotationId === annotationId) return prev;

            const noteKeys = noteKeyObjToArr(annotation.note_keys);
            const analysisIdtoAnalysis = new Map(analyses.map((analysis) => [analysis.id, analysis]));
            const analysisIdsWithNotes = new Set<string>();
            const hotData: EditStudyAnnotationsNoteCollectionReturn[] = [];

            (annotation.notes ?? []).forEach((note) => {
                if (!note.analysis || !note.study) return;
                // Handsontable edits these row objects in place, so they must not be react-query's objects
                const hotRow: EditStudyAnnotationsNoteCollectionReturn = JSON.parse(JSON.stringify(note));

                if (note.study === studyId) {
                    const analysis = analysisIdtoAnalysis.get(note.analysis);
                    // deleted in the study store but not saved yet
                    if (!analysis) return;
                    analysisIdsWithNotes.add(note.analysis);
                    hotRow.analysis_name = analysis.name || '';
                    hotRow.analysisDescription = analysis.description || '';
                }

                hotData.push(hotRow);
            });

            // analyses with no note yet, such as ones added in the study store but not saved
            analyses.forEach((analysis) => {
                if (!analysis.id || analysisIdsWithNotes.has(analysis.id)) return;
                hotData.push({
                    analysis: analysis.id,
                    study: studyId,
                    analysis_name: analysis.name || '',
                    analysisDescription: analysis.description || '',
                    note: Object.fromEntries(noteKeys.map((noteKey) => [noteKey.key, noteKey.default ?? null])),
                    isNew: !!analysis.isNew,
                });
            });

            return {
                annotationId,
                hotData,
                noteKeys,
                // hide the rows for analyses in other studies
                hiddenRows: hotData
                    .map((hotRow, index) => (hotRow.study !== studyId ? index : null))
                    .filter((index) => index !== null) as number[],
                ...createStudyAnnotationColumnSettings(noteKeys, !!readonly),
            };
        });
    }, [annotationId, annotation, isFetching, analyses, studyId, readonly]);

    return snapshot;
};

export default useEditStudyAnnotationsHotTable;
