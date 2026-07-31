import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import studysetQueries from 'hooks/studysets/studysetQueries';
import { StudysetReturnSummary } from 'hooks/studysets/studysetQueries.types';

const useGetStudysetSummaryById = (studysetId?: string) => {
    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<StudysetReturnSummary, AxiosError>({
        ...studysetQueries.summaryById(studysetId),
    });

    return {
        data,
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
    };
};

export const useGetStudysetSummarybyId = useGetStudysetSummaryById;

export default useGetStudysetSummaryById;
