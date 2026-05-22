import {
    useCreateStudy,
    useGetAnnotationById,
    useGetStudysetNonNestedById,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateStudyset,
} from 'hooks';
import { StudyReturnNested } from 'hooks/studies/studyQueries.types';
import { NoteCollectionReturn, StudyRequest } from 'neurostore-typescript-sdk';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import { useParams } from 'react-router-dom';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
} from 'stores/projects/ProjectStore';

const useCloneStudy = () => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    const { mutateAsync: createStudy, isLoading: cloneStudyIsLoading } = useCreateStudy();
    const { mutateAsync: updateStudyset, isLoading: updateStudysetIsLoading } = useUpdateStudyset();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { mutateAsync: updateAnnotationAnalyses, isLoading: updateAnnotationAnalysesIsLoading } =
        useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId);
    const replaceStudyWithNewClonedStudy = useProjectExtractionReplaceStudyListStatusId();
    const { data: annotation, isLoading: annotationIsLoading } = useGetAnnotationById(annotationId);
    const { data: studyset, isLoading: studysetIsLoading } = useGetStudysetNonNestedById(studysetId);

    const isLoading =
        cloneStudyIsLoading ||
        updateStudysetIsLoading ||
        annotationIsLoading ||
        studysetIsLoading ||
        updateAnnotationAnalysesIsLoading;

    const handleUpdateStudyset = async (clonedStudyId: string) => {
        if (!studyset?.studies || !studyId || !studysetId) return;
        if (!studyset.studies.includes(studyId)) throw new Error('study not found in studyset');
        if (!studyset.studyset_studies?.some((assoc) => assoc.id === studyId))
            throw new Error('study not found in studyset_studies');

        const studysetStudiesUpdate = [...(studyset.studyset_studies ?? [])]
            .filter((assoc) => !!assoc.id)
            .map((assoc) => ({
                id: assoc.id === studyId ? clonedStudyId : assoc.id!,
                curation_stub_uuid: assoc.curation_stub_uuid ?? undefined,
            }));

        return updateStudyset({
            studysetId: studysetId,
            studyset: {
                studies: studysetStudiesUpdate,
            },
        });
    };

    const handleApplyAnnotations = async (clone: StudyReturnNested) => {
        if (!annotationId) return;
        const annotationNotes = (annotation?.notes || []) as NoteCollectionReturn[];

        /**
         * The old annotations are not persisted for the cloned study, so we need to apply the old
         * annotation values to the new study. As we enforce unique analysis names, we can use the name as an identifier.
         */
        const notesUpdate = (clone.analyses ?? [])
            .map(({ id, name, study }) => {
                const foundNote = annotationNotes.find((note) => note.study === study && note.analysis_name === name);
                if (!foundNote) return;
                return {
                    ...foundNote,
                    analysis: id,
                    study: study,
                    note: {
                        ...foundNote.note,
                    },
                };
            })
            .filter((note) => note !== undefined);

        await updateAnnotationAnalyses(notesUpdate);
    };

    const cloneStudy = async (cloneWithStudyDetails: StudyRequest) => {
        if (!studyId || !studysetId || !studyset?.studies || isLoading) return;
        // 1. Create the clone
        const clonedStudy = (await createStudy({ sourceId: studyId, data: cloneWithStudyDetails })).data;
        const clonedStudyId = clonedStudy.id;
        if (!clonedStudyId) throw new Error('study not cloned correctly');

        // 2. Update the studyset containing the study with our new clone
        await handleUpdateStudyset(clonedStudyId);

        // 3. apply annotations
        await handleApplyAnnotations(clonedStudy);

        // 4. Update the surrounding state (project provenance and session storage)
        replaceStudyWithNewClonedStudy(studyId, clonedStudyId);
        updateExtractionTableStateStudySwapInStorage(projectId, studyId, clonedStudyId);

        return clonedStudy;
    };

    return { cloneStudy, isLoading };
};

export default useCloneStudy;
