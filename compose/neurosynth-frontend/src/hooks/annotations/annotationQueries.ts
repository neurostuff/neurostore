import API from 'api/api.config';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';

const annotationQueries = {
    all: () => ['annotations'] as const,

    lists: () => [...annotationQueries.all(), 'list'] as const,

    details: () => [...annotationQueries.all(), 'detail'] as const,

    byStudyset: (studysetId: string | undefined | null) => ({
        queryKey: [...annotationQueries.lists(), 'studyset', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.AnnotationsService.annotationsGet(studysetId || '');
            return res.data.results as AnnotationReturnOneOfWithNoteCollection[];
        },
        enabled: !!studysetId,
    }),

    byId: (annotationId: string | undefined | null) => ({
        queryKey: [...annotationQueries.details(), annotationId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || '');
            return res.data as AnnotationReturnOneOfWithNoteCollection;
        },
        enabled: !!annotationId,
    }),
};

export default annotationQueries;
