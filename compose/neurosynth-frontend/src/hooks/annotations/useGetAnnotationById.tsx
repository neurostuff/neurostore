import { useQuery } from '@tanstack/react-query';
import annotationQueries from 'hooks/annotations/annotationQueries';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(annotationQueries.byId(annotationId));
};

export default useGetAnnotationById;
