import { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import studysetQueries from 'hooks/studysets/studysetQueries';
import { StudysetReturnNonNested } from 'hooks/studysets/studysetQueries.types';
import { sortStudysetStudies } from 'hooks/studysets/useGetStudysetById.helpers';

const useGetStudysetNonNestedById = (studysetId?: string) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<StudysetReturnNonNested, AxiosError>({
        ...studysetQueries.nonNestedById(studysetId),
        onError: () => {
            enqueueSnackbar('there was an error retrieving the studyset', { variant: 'error' });
        },
        select: (studyset) => {
            sortStudysetStudies(studyset);
            return studyset;
        },
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

export default useGetStudysetNonNestedById;
