import { AxiosError } from 'axios';
import annotationQueries from 'hooks/annotations/annotationQueries';
import { useQuery } from 'react-query';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    const query = annotationQueries.byId(annotationId);
    return useQuery<
        Promise<AnnotationReturnOneOfWithNoteCollection>,
        AxiosError,
        AnnotationReturnOneOfWithNoteCollection,
        typeof query.queryKey
    >(query.queryKey, query.queryFn, {
        enabled: query.enabled,
    });
};

export default useGetAnnotationById;
