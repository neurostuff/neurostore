import API from 'api/api.config';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';

const annotationQueries = {
    all: () => ['annotations'] as const,

    lists: () => [...annotationQueries.all(), 'list'] as const,

    details: () => [...annotationQueries.all(), 'detail'] as const,

    byId: (annotationId: string | undefined | null) => ({
        queryKey: [...annotationQueries.details(), annotationId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || '');
            return res.data as AnnotationReturnOneOfWithNoteCollection;
        },
        enabled: !!annotationId,
    }),

    mutations: {
        update: () => [...annotationQueries.all(), 'update'] as const,
    },
};

export default annotationQueries;
