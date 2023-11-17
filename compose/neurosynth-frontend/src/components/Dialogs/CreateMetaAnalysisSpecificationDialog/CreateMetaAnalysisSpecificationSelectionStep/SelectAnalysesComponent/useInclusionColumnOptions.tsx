import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useMemo } from 'react';

const useInclusionColumnOptions = (
    annotationId: string | undefined,
    selectedKey: string | undefined
) => {
    const { data: annotation } = useGetAnnotationById(annotationId);

    const options = useMemo(() => {
        if (!selectedKey || !annotationId || !annotation || !annotation.notes) return [];

        const allNotes = annotation.notes as NoteCollectionReturn[];

        const annotationValuesSet = new Set<string>();
        (allNotes || []).forEach((note) => {
            if (!note.note) return;
            const value = (note.note as { [key: string]: string | boolean })[selectedKey];
            if (!value) return;
            if (annotationValuesSet.has(`${value}`)) {
            } else {
                annotationValuesSet.add(`${value}`);
            }
        });

        return Array.from(annotationValuesSet);
    }, [annotation, annotationId, selectedKey]);

    return options;
};

export default useInclusionColumnOptions;
