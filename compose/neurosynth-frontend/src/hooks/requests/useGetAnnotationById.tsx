import { AxiosResponse } from 'axios';
import { useQuery } from 'react-query';
import API, { NeurostoreAnnotation } from '../../utils/api';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(
        ['annotation', annotationId],
        () => API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || ''),
        {
            select: (res: AxiosResponse<NeurostoreAnnotation>) => res.data,
            enabled: !!annotationId,
        }
    );
};

export default useGetAnnotationById;
