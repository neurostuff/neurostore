import { useQuery } from 'react-query';
import API from '../../utils/api';

const useGetStudysets = (userId?: string) => {
    return useQuery(
        ['studysets', userId],
        () => API.NeurostoreServices.StudySetsService.studysetsGet(),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return userId ? res.filter((x) => x.user === userId) : res;
            },
        }
    );
};

export default useGetStudysets;
