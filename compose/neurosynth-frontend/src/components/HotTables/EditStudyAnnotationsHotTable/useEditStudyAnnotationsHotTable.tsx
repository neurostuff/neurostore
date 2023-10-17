import { useStudyAnalyses, useStudyId } from 'pages/Studies/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useAnnotationNoteKeys } from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';
import {
    createStudyAnnotationColHeaders,
    createStudyAnnotationColWidths,
    createStudyAnnotationColumns,
} from './EditStudyAnnotationsHotTable.helpers';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from './EditStudyAnnotationsHotTable.types';

const useEditStudyAnnotationsHotTable = () => {
    const studyId = useStudyId();
    const analyses = useStudyAnalyses();
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

    useEffect(() => {
        console.log(analyses);
        const timeout = setTimeout(() => {
            const update: EditStudyAnnotationsNoteCollectionReturn[] = [];
            analyses.forEach((analysis) => {
                const foundNote = notes?.find((note) => note.analysis === analysis.id);
                if (foundNote)
                    update.push({
                        ...foundNote,
                        analysis_name: analysis.name || '',
                        analysisDescription: analysis.description || '',
                    });
            });
            setData(update);
        }, 400);

        return () => {
            clearTimeout(timeout);
        };
    }, [analyses]);

    const hiddenRows = useMemo(() => {
        return (notes || [])
            .map((x, index) => (x.study !== studyId ? index : null))
            .filter((y) => y !== null) as number[];
    }, [notes, studyId]);

    const { columns, colHeaders, colWidths } = useMemo<IEditStudyAnnotationsDataRef>(() => {
        return {
            columns: createStudyAnnotationColumns(noteKeys || []),
            colHeaders: createStudyAnnotationColHeaders(noteKeys || []),
            colWidths: createStudyAnnotationColWidths(noteKeys || []),
        };
    }, [noteKeys]);

    // const data = useMemo<EditStudyAnnotationsNoteCollectionReturn[]>(() => {
    //     return (notes || []).map((note) => {
    //         const foundAnalysis = analyses.find((analysis) => analysis.id === note.analysis);

    //         return {
    //             ...note,
    //             analysis_name: foundAnalysis ? foundAnalysis.name || '' : '',
    //             analysisDescription: foundAnalysis ? foundAnalysis.description || '' : '',
    //         };
    //     });
    // }, [notes, analyses]);

    const height = useMemo(() => {
        const MIN_HEIGHT_PX = 150;
        const MAX_HEIGHT_PX = 500;
        const HEADER_HEIGHT_PX = 26;
        const ROW_HEIGHT_PX = 24;

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
