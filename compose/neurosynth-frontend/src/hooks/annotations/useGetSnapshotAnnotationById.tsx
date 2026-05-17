import { AxiosResponse } from 'axios';
import { AnnotationReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetSnapshotAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery(
        ['snapshot-annotations', annotationId],
        () => API.NeurosynthServices.AnnotationsService.snapshotAnnotationsIdGet(annotationId || ''),
        {
            select: (res: AxiosResponse<AnnotationReturn>) => res.data,
            enabled: !!annotationId,
        }
    );
};

export default useGetSnapshotAnnotationById;
