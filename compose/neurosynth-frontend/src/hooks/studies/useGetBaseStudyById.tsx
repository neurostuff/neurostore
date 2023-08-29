import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetBaseStudyById = (baseStudyId: string) => {
    return useQuery(
        ['studies', baseStudyId],
        () => API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(baseStudyId, true, true),
        {
            select: (res) => {
                return res.data;
            },
        }
    );
};

export default useGetBaseStudyById;
