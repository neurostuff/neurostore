import { AxiosResponse } from 'axios';
import { AnnotationReturnOneOf1 } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(
        ['annotations', annotationId],
        () => API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || ''),
        {
            select: (res: AxiosResponse<AnnotationReturnOneOf1>) => res.data,
            enabled: !!annotationId,
        }
    );
};

export default useGetAnnotationById;
