import { createColWidths } from 'components/HotTables/HotTables.utils';
import { useDebouncedStudyAnalyses, useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useAnnotationNoteKeys } from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';
import { createStudyAnnotationColumns } from '../components/EditStudyAnnotationsHotTable.helpers';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from '../components/EditStudyAnnotationsHotTable.types';
import { createColumnHeader } from 'pages/Annotations/components/EditAnnotationsHotTable.helpers';

const useEditStudyAnnotationsHotTable = (readonly?: boolean) => {
    const studyId = useStudyId();
    const debouncedAnalyses = useDebouncedStudyAnalyses();
    const noteKeys = useAnnotationNoteKeys();
    const notes = useAnnotationNotes();

    const [data, setData] = useState<EditStudyAnnotationsNoteCollectionReturn[]>();

    useEffect(() => {
        if (!notes) return;
        setData([...notes]);
    }, [notes]);

    /**
     * this hook runs everytime (AND ONLY WHEN) the analyses change (i.e. when someone is updating the analysis name or description).
     * From an annotation perspective, the analysis name and description is purely decorative so we debounce the updates here
     */
    useEffect(() => {
        setData((prev) => {
            if (!prev) return prev;
            const update = [...prev];
            debouncedAnalyses.forEach((analysis) => {
                const foundNoteIndex = update.findIndex((updateNote) => updateNote.analysis === analysis.id);
                if (foundNoteIndex < 0) return;

                update[foundNoteIndex] = {
                    ...update[foundNoteIndex],
                    analysis_name: analysis.name || '',
                    analysisDescription: analysis.description || '',
                };
            });
            return update;
        });
    }, [debouncedAnalyses]);

    // only show the indices for rows that we want to hide
    const hiddenRows = useMemo(() => {
        return (notes || [])
            .map((x, index) => (x.study !== studyId ? index : null))
            .filter((y) => y !== null) as number[];
    }, [notes, studyId]);

    const { columns, colHeaders, colWidths } = useMemo<IEditStudyAnnotationsDataRef>(() => {
        return {
            columns: createStudyAnnotationColumns(noteKeys || [], !!readonly),
            colHeaders: [
                'Analysis Name',
                'Analysis Description',
                ...(noteKeys ?? []).map((x) => createColumnHeader(x.key, x.type, false)),
            ],
            colWidths: createColWidths(noteKeys || [], 150, 150, 150),
        };
    }, [noteKeys, readonly]);

    return {
        hiddenRows,
        columns,
        colHeaders,
        colWidths,
        data: data || [],
    };
};

export default useEditStudyAnnotationsHotTable;
