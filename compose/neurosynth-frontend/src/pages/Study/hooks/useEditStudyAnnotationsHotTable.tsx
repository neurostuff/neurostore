import { createColWidths } from 'components/HotTables/HotTables.utils';
import { useDebouncedStudyAnalyses, useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useAnnotationNoteKeys, useUpdateAnnotationNoteDetails } from 'stores/AnnotationStore.actions';
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
    const updateAnnotationNoteName = useUpdateAnnotationNoteDetails();

    const [data, setData] = useState<EditStudyAnnotationsNoteCollectionReturn[]>();

    useEffect(() => {
        if (!notes) return;
        setData((prev) => {
            if (!prev || prev.length === 0) return [...notes];

            // Create a hashmap for faster performance with large datasets (we could potentially have thousands of analyses)
            const prevMap = new Map(prev.map((n) => [n.analysis, n]));

            // Merge store notes with existing local state to preserve derived values like analysisDescription
            return notes.map((storeNote) => {
                const existingNote = prevMap.get(storeNote.analysis);
                if (!existingNote) return storeNote;

                return {
                    ...storeNote,
                    analysisDescription: existingNote.analysisDescription || undefined,
                } as EditStudyAnnotationsNoteCollectionReturn;
            });
        });
    }, [notes]);

    /**
     * this hook runs everytime (AND ONLY WHEN) the analyses change (i.e. when someone is updating the analysis name or description).
     * From an annotation perspective, the analysis name and description is purely decorative so we debounce the updates here
     */
    useEffect(() => {
        debouncedAnalyses.forEach((analysis) => {
            updateAnnotationNoteName({
                analysis: analysis.id,
                analysis_name: analysis.name,
            });
        });

        setData((prev) => {
            if (!prev) return prev;
            const update = [...prev];
            debouncedAnalyses.forEach((analysis) => {
                const foundNoteIndex = update.findIndex((updateNote) => updateNote.analysis === analysis.id);
                if (foundNoteIndex < 0) return;

                update[foundNoteIndex] = {
                    ...update[foundNoteIndex],
                    analysisDescription: analysis.description || undefined,
                };
            });

            return update;
        });
    }, [debouncedAnalyses, updateAnnotationNoteName]);

    // return the indices for rows that we want to hide
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
                ...(noteKeys ?? []).map((x) => createColumnHeader(x.key, x.type, true)),
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
