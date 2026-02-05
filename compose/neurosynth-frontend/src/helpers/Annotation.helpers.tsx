import { AxiosResponse } from 'axios';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'api/api.config';
import { storeNotesToDBNotes } from 'stores/AnnotationStore.helpers';

export const setAnalysesInAnnotationAsIncluded = async (annotationId: string) => {
    try {
        const annotation = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
            annotationId
        )) as AxiosResponse<NeurostoreAnnotation>;
        const notes = (annotation.data.notes || []) as NoteCollectionReturn[];

        await API.NeurostoreServices.AnnotationsService.annotationsIdPut(annotationId, {
            notes: storeNotesToDBNotes(notes),
        });
    } catch (e) {
        console.error(e);
        throw new Error('error setting annotations as included');
    }
};
