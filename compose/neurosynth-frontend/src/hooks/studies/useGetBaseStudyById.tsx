import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetBaseStudyById = (baseStudyId: string | undefined) => {
    return useQuery(
        ['studies', baseStudyId],
        () => API.NeurostoreServices.StudiesService.baseStudiesIdGet(baseStudyId || '', false, true),
        {
            select: (res) => {
                return res.data;
            },
            enabled: !!baseStudyId,
        }
    );
};

export default useGetBaseStudyById;
