import { useQuery } from 'react-query';
import API, { NeurostoreAnnotation } from 'api/api.config';

const useGetAnnotationsByStudysetId = (studyId: string | undefined | null) => {
    return useQuery(
        ['annotations', studyId],
        () => API.NeurostoreServices.AnnotationsService.annotationsGet(studyId || ''),
        {
            select: (res) => res.data.results as NeurostoreAnnotation[],
            enabled: !!studyId,
        }
    );
};

export default useGetAnnotationsByStudysetId;
