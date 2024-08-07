import { createColWidths } from 'components/HotTables/HotTables.utils';
import { useDebouncedStudyAnalyses, useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useAnnotationNoteKeys } from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';
import {
    createStudyAnnotationColHeaders,
    createStudyAnnotationColumns,
} from 'pages/Study/components/EditStudyAnnotationsHotTable.helpers';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from 'pages/Study/components/EditStudyAnnotationsHotTable.types';

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

            const update = [...prev].map((updateItem, index) => ({
                ...updateItem,
                ...notes[index],
            }));
            return update;
        });
    }, [notes]);

    /**
     * this hook runs everytime (AND ONLY WHEN) the analyses change (i.e. when someone is updating the analysis name or description).
     * From an annotation perspective, the analysis name and description is purely decorative so we debounce the updates here
     */
    useEffect(() => {
        setData((prev) => {
            if (!prev) return prev;
            const update: EditStudyAnnotationsNoteCollectionReturn[] = [...(notes || [])];
            debouncedAnalyses.forEach((analysis) => {
                const foundNoteIndex = update.findIndex(
                    (updateNote) => updateNote.analysis === analysis.id
                );
                if (foundNoteIndex < 0) return;

                update[foundNoteIndex] = {
                    ...update[foundNoteIndex],
                    analysis_name: analysis.name || '',
                    analysisDescription: analysis.description || '',
                };
            });
            return update;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedAnalyses]);

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
