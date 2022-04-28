import { useQuery } from 'react-query';
import API from '../../utils/api';

const useStudyById = (studyId: string) => {
    const { data, isLoading, isError, error } = useQuery(['studiesIdGet', studyId], () =>
        API.NeurostoreServices.StudiesService.studiesIdGet(studyId, true)
    );

    return {
        data,
        isLoading,
        isError,
        error,
    };
};

export default useStudyById;
