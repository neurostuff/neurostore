import { Box } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import {
    AnalysisReturn,
    ConditionRequest,
    PointRequest,
    StudyRequest,
} from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Projects/ProjectPage/ProjectStore';

import { useAuth0 } from '@auth0/auth0-react';
import {
    useCreateStudy,
    useGetStudysetById,
    useUpdateAnnotationById,
    useUpdateStudy,
    useUpdateStudyset,
} from 'hooks';
import EditStudyPageStyles from 'pages/Studies/EditStudyPage/EditStudyPage.styles';
import {
    useStudy,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyUser,
    useUpdateStudyInDB,
    useUpdateStudyIsLoading,
} from 'pages/Studies/StudyStore';
import { storeAnalysesToStudyAnalyses } from 'pages/Studies/StudyStore.helpers';
import React, { useState } from 'react';
import { useQueryClient } from 'react-query';
import { useHistory } from 'react-router-dom';
import { useUpdateAnnotationInDB, useUpdateAnnotationNotes } from 'stores/AnnotationStore.actions';
import {
    useAnnotationIsEdited,
    useAnnotationNotes,
    useUpdateAnnotationIsLoading,
} from 'stores/AnnotationStore.getters';
import { storeNotesToDBNotes } from 'stores/AnnotationStore.helpers';
import API from 'utils/api';
import { arrayToMetadata } from '../EditStudyMetadata/EditStudyMetadata';
import EditStudySwapVersionButton from '../EditStudySwapVersionButton/EditStudySwapVersionButton';
import { hasDuplicateStudyAnalysisNames, hasEmptyStudyPoints } from './EditStudySaveButton.helpers';
import { STUDYSET_QUERY_STRING } from 'hooks/studysets/useGetStudysets';

const EditStudySaveButton: React.FC = React.memo((props) => {
    const { user } = useAuth0();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const history = useHistory();

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
    const annotationHasBeenEdited = useAnnotationIsEdited();
    const notes = useAnnotationNotes();
    const annotationIsEdited = useAnnotationIsEdited();
    const updateAnnotationNotes = useUpdateAnnotationNotes();
    const updateAnnotationInDB = useUpdateAnnotationInDB();

    const { data: studyset } = useGetStudysetById(studysetId || undefined, false);
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const { mutateAsync: createStudy } = useCreateStudy();
    const { mutateAsync: updateStudy } = useUpdateStudy();
    const { mutateAsync: updateAnnotation } = useUpdateAnnotationById(annotationId);

    const [isCloning, setIsCloning] = useState(false);

    const handleUpdateBothInDB = async () => {
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

        queryClient.invalidateQueries('studies');
        queryClient.invalidateQueries('annotations');

        enqueueSnackbar('Study and annotation saved', { variant: 'success' });
    };

    const handleUpdateStudyInDB = async () => {
        await updateStudyInDB(annotationId as string);
        queryClient.invalidateQueries('studies');
        queryClient.invalidateQueries('annotations');

        enqueueSnackbar('Study saved', { variant: 'success' });
    };

    const handleUpdateAnnotationInDB = async () => {
        await updateAnnotationInDB();
        queryClient.invalidateQueries('annotations');
        enqueueSnackbar('Annotation saved', { variant: 'success' });
    };

    const handleUpdateDB = () => {
        try {
            if (studyHasBeenEdited && annotationIsEdited) {
                handleUpdateBothInDB();
            } else if (studyHasBeenEdited) {
                handleUpdateStudyInDB();
            } else if (annotationIsEdited) {
                handleUpdateAnnotationInDB();
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
            analyses: storeAnalysesToStudyAnalyses(storeStudy.analyses).map((analysis) => {
                const scrubbedAnalysis = { ...analysis };
                ((scrubbedAnalysis.points || []) as PointRequest[]).forEach((point) => {
                    delete point.id;
                    delete point.analysis;
                });
                ((scrubbedAnalysis.conditions || []) as ConditionRequest[]).forEach((condition) => {
                    delete condition.id;
                });

                delete scrubbedAnalysis.id;
                delete scrubbedAnalysis.study;

                return scrubbedAnalysis;
            }),
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
            const currentStudyBeingEditedIndex = studyset.studies.findIndex(
                (study) => study === storeStudy.id
            );
            if (currentStudyBeingEditedIndex < 0) throw new Error('study not found in studyset');

            // 1. clone the study
            const clonedStudy = (await createStudy(storeStudy.id)).data;
            const clonedStudyId = clonedStudy.id;
            if (!clonedStudyId) throw new Error('study not cloned correctly');

            // 2. update the clone with our latest updates
            await updateStudy({
                studyId: clonedStudyId,
                study: {
                    ...getNewScrubbedStudyFromStore(),
                    id: clonedStudyId,
                },
            });

            const updatedClone = (
                await API.NeurostoreServices.StudiesService.studiesIdGet(clonedStudyId, true)
            ).data;

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

            history.push(`/projects/${projectId}/extraction/studies/${clonedStudyId}`);
            enqueueSnackbar('Saved successfully. You are now the owner of this study', {
                variant: 'success',
            });
        } catch (e) {
            enqueueSnackbar(
                'We encountered an error saving your study. Please contact the neurosynth-compose team',
                { variant: 'error' }
            );
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

        const { isError: emptyPointError, errorMessage: emptyPointErrorMessage } =
            hasEmptyStudyPoints(analyses);
        if (emptyPointError) {
            enqueueSnackbar(emptyPointErrorMessage, { variant: 'warning' });
            return;
        }

        const currentUserOwnsThisStudy = (studyOwnerUser || null) === (user?.sub || undefined);
        if (currentUserOwnsThisStudy) {
            handleUpdateDB();
        } else {
            if (studyHasBeenEdited) {
                handleClone();
            } else {
                handleUpdateDB();
            }
        }
    };

    return (
        <Box sx={EditStudyPageStyles.loadingButtonContainer}>
            <EditStudySwapVersionButton />
            <LoadingButton
                text="save"
                isLoading={updateStudyIsLoading || updateAnnotationIsLoading || isCloning}
                variant="contained"
                loaderColor="secondary"
                disabled={!studyHasBeenEdited && !annotationHasBeenEdited}
                disableElevation
                sx={{ width: '280px', height: '36px' }}
                onClick={handleSave}
            />
        </Box>
    );
});

export default EditStudySaveButton;
