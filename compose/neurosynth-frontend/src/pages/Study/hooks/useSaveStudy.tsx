import { useAuth0 } from '@auth0/auth0-react';
import { unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useCreateStudy, useGetStudysetById, useUpdateAnnotationById, useUpdateStudyset } from 'hooks';
import { STUDYSET_QUERY_STRING } from 'hooks/studysets/useGetStudysets';
import { AnalysisReturn, StudyRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useUpdateAnnotationInDB, useUpdateAnnotationNotes } from 'stores/AnnotationStore.actions';
import {
    useAnnotationIsEdited,
    useAnnotationNotes,
    useUpdateAnnotationIsLoading,
} from 'stores/AnnotationStore.getters';
import { storeNotesToDBNotes } from 'stores/AnnotationStore.helpers';
import API from 'utils/api';
import { arrayToMetadata } from '../components/EditStudyMetadata';
import {
    useStudy,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyUser,
    useUpdateStudyInDB,
    useUpdateStudyIsLoading,
} from 'pages/Study/store/StudyStore';
import { storeAnalysesToStudyAnalyses } from '../store/StudyStore.helpers';
import { hasDuplicateStudyAnalysisNames, hasEmptyStudyPoints } from './useSaveStudy.helpers';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';

const useSaveStudy = () => {
    const { user } = useAuth0();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();

    // project stuff
    const replaceStudyWithNewClonedStudy = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const projectId = useProjectId();
    // study stuff
    const storeStudy = useStudy();
    const studyOwnerUser = useStudyUser();
    const updateStudyIsLoading = useUpdateStudyIsLoading();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const analyses = useStudyAnalyses();
    const updateStudyInDB = useUpdateStudyInDB();
    // annotation stuff
    const updateAnnotationIsLoading = useUpdateAnnotationIsLoading();
    const notes = useAnnotationNotes();
    const annotationIsEdited = useAnnotationIsEdited();
    const updateAnnotationNotes = useUpdateAnnotationNotes();
    const updateAnnotationInDB = useUpdateAnnotationInDB();

    const { data: studyset } = useGetStudysetById(studysetId || undefined, false);
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const { mutateAsync: createStudy } = useCreateStudy();
    const { mutateAsync: updateAnnotation } = useUpdateAnnotationById(annotationId);

    const [isCloning, setIsCloning] = useState(false);

    const handleUpdateBothInDB = async () => {
        try {
            const updatedStudy = await updateStudyInDB(annotationId as string);
            const updatedNotes = [...(notes || [])];
            updatedNotes.forEach((note, index) => {
                if (note.isNew) {
                    const foundAnalysis = ((updatedStudy.analyses || []) as AnalysisReturn[]).find(
                        (analysis) => analysis.name === note.analysis_name
                    );
                    if (!foundAnalysis) return;

                    updatedNotes[index] = {
                        ...updatedNotes[index],
                        analysis: foundAnalysis.id,
                    };
                }
            });
            updateAnnotationNotes(updatedNotes);
            await updateAnnotationInDB();
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');

            queryClient.invalidateQueries('studies');
            queryClient.invalidateQueries('annotations');

            enqueueSnackbar('Study and annotation saved', { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error', { variant: 'error' });
        }
    };

    const handleUpdateStudyInDB = async () => {
        try {
            await updateStudyInDB(annotationId as string);
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            queryClient.invalidateQueries('studies');
            queryClient.invalidateQueries('annotations');

            enqueueSnackbar('Study saved', { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error saving the study', { variant: 'error' });
        }
    };

    const handleUpdateAnnotationInDB = async () => {
        try {
            await updateAnnotationInDB();
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            queryClient.invalidateQueries('annotations');
            enqueueSnackbar('Annotation saved', { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an issue saving the annotation', { variant: 'error' });
        }
    };

    const handleUpdateDB = async () => {
        try {
            if (studyHasBeenEdited && annotationIsEdited) {
                await handleUpdateBothInDB();
            } else if (studyHasBeenEdited) {
                await handleUpdateStudyInDB();
            } else if (annotationIsEdited) {
                await handleUpdateAnnotationInDB();
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error saving to the database', {
                variant: 'error',
            });
        }
    };

    const getNewScrubbedStudyFromStore = () => {
        const updatedStudy: StudyRequest = {
            name: storeStudy.name,
            description: storeStudy.description,
            doi: storeStudy.doi,
            pmid: storeStudy.pmid,
            metadata: arrayToMetadata(storeStudy.metadata),
            publication: storeStudy.publication,
            authors: storeStudy.authors,
            year: storeStudy.year,
            analyses: storeAnalysesToStudyAnalyses(storeStudy.analyses),
        };

        return updatedStudy;
    };

    const handleClone = async () => {
        if (
            !storeStudy.id ||
            !studysetId ||
            !studyset ||
            !studyset.studies ||
            !annotationId ||
            studyset.studies.length === 0
        ) {
            return;
        }
        setIsCloning(true);
        try {
            const currentStudyBeingEditedIndex = studyset.studies.findIndex((study) => study === storeStudy.id);
            if (currentStudyBeingEditedIndex < 0) throw new Error('study not found in studyset');

            // 1. clone the study
            const clonedStudy = (await createStudy({ sourceId: storeStudy.id, data: getNewScrubbedStudyFromStore() }))
                .data;
            const clonedStudyId = clonedStudy.id;
            if (!clonedStudyId) throw new Error('study not cloned correctly');

            const updatedClone = (await API.NeurostoreServices.StudiesService.studiesIdGet(clonedStudyId, true)).data;

            // 3. update the studyset containing the study with our new clone
            const updatedStudies = [...(studyset.studies as string[])];
            updatedStudies[currentStudyBeingEditedIndex] = clonedStudyId;
            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: updatedStudies,
                },
            });
            queryClient.invalidateQueries(STUDYSET_QUERY_STRING);

            // 4. update the project as this keeps track of completion status of studies
            replaceStudyWithNewClonedStudy(storeStudy.id, clonedStudyId);
            updateExtractionTableStateStudySwapInStorage(projectId, storeStudy.id, clonedStudyId);

            // 5. as this is a completely new study, that we've just created, the annotations are cleared.
            // We need to update the annotations with our latest changes, and associate newly created analyses with their corresponding analysis changes.
            //      - we do this based on the analysis names since the IDs are assigned by neurostore
            const updatedNotes = [...(notes || [])];
            ((updatedClone.analyses || []) as AnalysisReturn[]).forEach((analysis) => {
                const foundNoteIndex = updatedNotes.findIndex(
                    (note) => note.analysis_name === analysis.name && note.study === storeStudy.id
                );
                if (foundNoteIndex < 0) return;
                updatedNotes[foundNoteIndex] = {
                    ...updatedNotes[foundNoteIndex],
                    analysis: analysis.id,
                    study: clonedStudyId,
                    note: {
                        ...updatedNotes[foundNoteIndex].note,
                    },
                };
            });
            await updateAnnotation({
                argAnnotationId: annotationId,
                annotation: {
                    notes: storeNotesToDBNotes(updatedNotes),
                },
            });

            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');

            navigate(`/projects/${projectId}/extraction/studies/${clonedStudyId}/edit`);
            enqueueSnackbar('Made a new a copy and saved succesfully', {
                variant: 'success',
            });

            return clonedStudyId;
        } catch (e) {
            enqueueSnackbar('We encountered an error saving your study. Please contact the neurosynth-compose team', {
                variant: 'error',
            });
            console.error(e);
        } finally {
            setIsCloning(false);
        }
    };

    const handleSave = async () => {
        const { isError: hasDuplicateError, errorMessage: hasDuplicateErrorMessage } =
            hasDuplicateStudyAnalysisNames(analyses);
        if (hasDuplicateError) {
            enqueueSnackbar(hasDuplicateErrorMessage, { variant: 'warning' });
            return;
        }

        const { isError: emptyPointError, errorMessage: emptyPointErrorMessage } = hasEmptyStudyPoints(analyses);
        if (emptyPointError) {
            enqueueSnackbar(emptyPointErrorMessage, { variant: 'warning' });
            return;
        }

        const currentUserOwnsThisStudy = (studyOwnerUser || null) === (user?.sub || undefined);
        if (currentUserOwnsThisStudy) {
            await handleUpdateDB();
        } else {
            if (studyHasBeenEdited) {
                return await handleClone();
            } else {
                await handleUpdateDB();
            }
        }
    };

    const isLoading = updateStudyIsLoading || updateAnnotationIsLoading || isCloning;
    const hasEdits = studyHasBeenEdited || annotationIsEdited;

    return { isLoading, hasEdits, handleSave };
};

export default useSaveStudy;
