import { AxiosError } from 'axios';
import { AnnotationReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetSnapshotAnnotationById = (annotationId: string | undefined | null) => {
    return useQuery<AnnotationReturn | null>(
        ['snapshot-annotations', annotationId],
        async () => {
            try {
                const res = await API.NeurosynthServices.AnnotationsService.snapshotAnnotationsIdGet(
                    annotationId || ''
                );
                return res.data;
            } catch (error) {
                if ((error as AxiosError)?.response?.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        {
            enabled: !!annotationId,
        }
    );
};

export default useGetSnapshotAnnotationById;
