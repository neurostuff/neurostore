import { useQuery } from 'react-query';
import API from '../../utils/api';

const useGetAnnotationsByStudysetId = (studyId: string | undefined | null) => {
    return useQuery(
        ['annotations', studyId],
        () => API.NeurostoreServices.AnnotationsService.annotationsGet(studyId || ''),
        {
            select: (res) => res.data.results,
            enabled: !!studyId,
        }
    );
};

export default useGetAnnotationsByStudysetId;
