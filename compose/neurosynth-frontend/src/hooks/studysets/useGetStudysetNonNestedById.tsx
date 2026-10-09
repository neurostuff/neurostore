import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import studysetQueries from 'hooks/studysets/studysetQueries';
import { StudysetReturnNonNested } from 'hooks/studysets/studysetQueries.types';

const useGetStudysetNonNestedById = (studysetId?: string) => {
    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<StudysetReturnNonNested, AxiosError>(
        studysetQueries.nonNestedById(studysetId)
    );

    return {
        data,
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
    };
};

export default useGetStudysetNonNestedById;
