import { useGetAnnotationById, useGetStudysetNestedById } from 'hooks';
import { useMemo } from 'react';
import { AnnotationNoteType } from 'stores/annotation/AnnotationStore.types';
import { useProjectExtractionAnnotationId, useProjectExtractionStudysetId } from 'stores/projects/ProjectStore';
import { isALE } from '../components/MetaAnalysisDynamicForm';

const hasSampleSizeInObj = (note: object | null | undefined): boolean => {
    if (!note) return false;
    const val = (note as AnnotationNoteType).sample_size;
    return typeof val === 'number' && val !== null;
};

const useStudiesWithMissingSampleSizeALE = (algorithm: string | undefined) => {
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetNestedById(studysetId);
    const annotationIdFromProject = useProjectExtractionAnnotationId();
    const { data: annotation } = useGetAnnotationById(annotationIdFromProject);

    const studiesMissingSampleSize = useMemo(() => {
        if (!studyset?.studies || !annotation?.notes) return [];
        const studies = studyset.studies;
        const notes = annotation.notes ?? [];
        const missing: { studyId: string; studyName: string | null }[] = [];
        for (const study of studies) {
            const studyId = study.id;
            const studyName = study.name ?? null;
            const studyMetadata = study.metadata;
            if (!studyId) continue;
            const notesForStudy = notes.filter((n) => n.study === studyId);
            const hasFromAnnotation =
                notesForStudy.length > 0 && notesForStudy.every((n) => hasSampleSizeInObj(n.note));
            const hasFromMetadata = hasSampleSizeInObj(studyMetadata);
            if (!hasFromAnnotation && !hasFromMetadata) {
                missing.push({ studyId: studyId, studyName: studyName });
            }
        }
        return missing;
    }, [studyset?.studies, annotation?.notes]);

    return isALE(algorithm ?? '') ? studiesMissingSampleSize : [];
};

export default useStudiesWithMissingSampleSizeALE;
