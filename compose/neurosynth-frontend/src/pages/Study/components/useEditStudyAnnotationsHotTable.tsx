import { createColWidths } from 'components/HotTables/HotTables.utils';
import { useDebouncedStudyAnalyses, useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useAnnotationNoteKeys } from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';
import {
    createStudyAnnotationColHeaders,
    createStudyAnnotationColumns,
} from './EditStudyAnnotationsHotTable.helpers';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from './EditStudyAnnotationsHotTable.types';
import { IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';
import { IStoreAnalysis } from '../store/StudyStore.helpers';

const useEditStudyAnnotationsHotTable = (readonly?: boolean) => {
    const studyId = useStudyId();
    const debouncedAnalyses = useDebouncedStudyAnalyses();
    const noteKeys = useAnnotationNoteKeys();
    const notes = useAnnotationNotes();

    const [data, setData] = useState<EditStudyAnnotationsNoteCollectionReturn[]>();

    useEffect(() => {
        if (!notes) return;
        setData((prev) => {
            if (!prev) return [...notes];
            const update: { note: IStoreNoteCollectionReturn; analysis?: IStoreAnalysis }[] =
                notes.map((note) => {
                    const analysisId = note.analysis;
                    if (!analysisId) return { note, analysis: undefined };
                    const foundIndex = debouncedAnalyses.findIndex(
                        (debouncedAnalysis) => debouncedAnalysis.id === analysisId
                    );
                    if (foundIndex < 0) return { note, analysis: undefined };

                    const updatedNote = {
                        ...note,
                        analysis_name: debouncedAnalyses[foundIndex].name,
                        analysisDescription: debouncedAnalyses[foundIndex].description,
                    };

                    return { note: updatedNote, analysis: debouncedAnalyses[foundIndex] };
                });

            return update
                .sort((a, b) => {
                    if (!a.analysis?.order || !b.analysis?.order) return 0;
                    return (
                        new Date(a.analysis.created_at || '').valueOf() -
                        new Date(b.analysis.created_at || '').valueOf()
                    );
                })
                .map((x) => x.note);
        });
    }, [debouncedAnalyses, notes]);

    const hiddenRows = useMemo(() => {
        return (notes || [])
            .map((x, index) => (x.study !== studyId ? index : null))
            .filter((y) => y !== null) as number[];
    }, [notes, studyId]);

    const { columns, colHeaders, colWidths } = useMemo<IEditStudyAnnotationsDataRef>(() => {
        return {
            columns: createStudyAnnotationColumns(noteKeys || [], !!readonly),
            colHeaders: createStudyAnnotationColHeaders(noteKeys || []),
            colWidths: createColWidths(noteKeys || [], 200, 250, 150),
        };
    }, [noteKeys, readonly]);

    const height = useMemo(() => {
        const MIN_HEIGHT_PX = 100;
        const MAX_HEIGHT_PX = 500;
        const HEADER_HEIGHT_PX = 26;
        const ROW_HEIGHT_PX = 24; // +24 to padd row height a little bit

        const visibleNotes = (notes || []).filter((x) => x.study === studyId);

        const TABLE_HEIGHT_PX = HEADER_HEIGHT_PX + visibleNotes.length * ROW_HEIGHT_PX;
        return TABLE_HEIGHT_PX < MIN_HEIGHT_PX
            ? MIN_HEIGHT_PX
            : TABLE_HEIGHT_PX > MAX_HEIGHT_PX
            ? MAX_HEIGHT_PX
            : TABLE_HEIGHT_PX;
    }, [notes, studyId]);

    return {
        hiddenRows,
        columns,
        colHeaders,
        colWidths,
        data: data || [],
        height,
    };
};

export default useEditStudyAnnotationsHotTable;
