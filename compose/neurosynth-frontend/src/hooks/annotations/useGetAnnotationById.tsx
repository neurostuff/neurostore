import { AxiosResponse } from 'axios';
import { AnnotationReturnOneOf } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(
        ['annotations', annotationId],
        () => API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || ''),
        {
            select: (res: AxiosResponse<AnnotationReturnOneOf>) => res.data,
            enabled: !!annotationId,
        }
    );
};

export default useGetAnnotationById;
