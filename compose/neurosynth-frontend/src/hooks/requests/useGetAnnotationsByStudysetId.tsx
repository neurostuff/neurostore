import { useQuery } from 'react-query';
import API, { NeurostoreAnnotation } from 'utils/api';

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
