import { AxiosResponse } from 'axios';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'api/api.config';

export const setAnalysesInAnnotationAsIncluded = async (annotationId: string) => {
    try {
        const annotation = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
            annotationId
        )) as AxiosResponse<NeurostoreAnnotation>;

        let notes = (annotation.data.notes || []) as NoteCollectionReturn[];

        await API.NeurostoreServices.AnnotationsService.annotationsIdPut(annotationId, {
            notes: notes.map((x) => ({
                analysis: x.analysis,
                study: x.study,
                note: {
                    ...x.note,
                    // included can be null meaning it has not been instantiated. We only want to set it to true
                    // if it has not been instantiated as that will overwrite the value is the user previously set it to false
                    included: (x.note as any)?.included === false ? false : true,
                },
            })),
        });
    } catch (e) {
        console.error(e);
        throw new Error('error setting annotations as included');
    }
};
