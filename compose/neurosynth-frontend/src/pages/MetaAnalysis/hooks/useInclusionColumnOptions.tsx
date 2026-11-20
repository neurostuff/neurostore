import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';
import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useMemo } from 'react';

const useInclusionColumnOptions = (
    annotationId: string | undefined,
    selectedKey: string | undefined
): Record<string, number> => {
    const { data: annotation } = useGetAnnotationById(annotationId);

    return useMemo(() => {
        if (!selectedKey || !annotationId || !annotation?.notes) return {};

        const studyIdsByAnnotationValue = new Map<string, Set<string>>();
        (annotation.notes as NoteCollectionReturn[]).forEach((note) => {
            const noteValues = note.note as { [key: string]: AnnotationNoteValue } | undefined;
            if (!noteValues) return;
            const value = noteValues[selectedKey];
            if (value === null || value === undefined) return;

            const annotationValue = `${value}`;
            const studyIds = studyIdsByAnnotationValue.get(annotationValue) ?? new Set<string>();
            if (note.study) {
                studyIds.add(note.study);
            }
            studyIdsByAnnotationValue.set(annotationValue, studyIds);
        });

        const studyCountByAnnotationValue: Record<string, number> = {};
        studyIdsByAnnotationValue.forEach((studyIds, annotationValue) => {
            studyCountByAnnotationValue[annotationValue] = studyIds.size;
        });
        return studyCountByAnnotationValue;
    }, [annotation, annotationId, selectedKey]);
};

export default useInclusionColumnOptions;
