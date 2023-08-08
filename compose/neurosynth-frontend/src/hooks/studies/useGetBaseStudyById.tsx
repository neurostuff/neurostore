import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetBaseStudyById = (baseStudyId: string) => {
    return useQuery(
        ['studies', baseStudyId],
        () => API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(baseStudyId),
        {
            select: (res) => {
                return res.data;
            },
        }
    );
};

export default useGetBaseStudyById;
