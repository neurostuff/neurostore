import { AxiosResponse } from 'axios';
import { Annotation, ReadOnly } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from '../../utils/api';

const useGetAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(
        ['annotation', annotationId],
        () => API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId || ''),
        {
            select: (res: AxiosResponse<Annotation & ReadOnly>) => res.data,
            enabled: !!annotationId,
        }
    );
};

export default useGetAnnotationById;
