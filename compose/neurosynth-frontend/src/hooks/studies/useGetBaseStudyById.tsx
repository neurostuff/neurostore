import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetBaseStudyById = (baseStudyId: string | undefined) => {
    return useQuery({
        queryKey: ['studies', baseStudyId],
        queryFn: () => API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(baseStudyId || '', false, true),

        select: (res) => {
            return res.data;
        },

        enabled: !!baseStudyId
    });
};

export default useGetBaseStudyById;
