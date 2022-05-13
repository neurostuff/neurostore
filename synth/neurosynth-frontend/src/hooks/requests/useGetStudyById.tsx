import { useQuery } from 'react-query';
import API from '../../utils/api';

const useGetStudyById = (studyId: string) => {
    const { data, isLoading, isError, error } = useQuery(['studies', studyId], () =>
        API.NeurostoreServices.StudiesService.studiesIdGet(studyId, true)
    );

    return {
        data,
        isLoading,
        isError,
        error,
    };
};

export default useGetStudyById;
