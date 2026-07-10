import { useGetAnnotationById, useGetStudysetById } from 'hooks';
import { NoteCollectionReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { useProjectExtractionAnnotationId, useProjectExtractionStudysetId } from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';
import { AnnotationNoteType } from 'stores/AnnotationStore.types';
import { isALE } from '../components/MetaAnalysisDynamicForm';

const hasSampleSizeInObj = (note: object | null | undefined): boolean => {
    if (!note) return false;
    const val = (note as AnnotationNoteType).sample_size;
    return typeof val === 'number' && val !== null;
};

const useStudiesWithMissingSampleSizeALE = (algorithm: string | undefined) => {
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, true, false);
    const annotationIdFromProject = useProjectExtractionAnnotationId();
    const { data: annotation } = useGetAnnotationById(annotationIdFromProject);

    const studiesMissingSampleSize = useMemo(() => {
        if (!studyset?.studies || !annotation?.notes) return [];
        const studies = studyset.studies as StudyReturn[];
        const notes = (annotation.notes || []) as NoteCollectionReturn[];
        const missing: { studyId: string; studyName: string | null }[] = [];
        for (const study of studies) {
            const studyId = typeof study === 'string' ? study : study.id;
            const studyName = typeof study === 'string' ? null : (study.name ?? null);
            const studyMetadata = typeof study === 'string' ? undefined : study.metadata;
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
