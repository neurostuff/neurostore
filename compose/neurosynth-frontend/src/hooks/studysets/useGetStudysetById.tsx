import { AxiosError, AxiosResponse } from 'axios';
import { StudysetReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import API from 'utils/api';
import { STUDYSET_QUERY_STRING } from './useGetStudysets';

const useGetStudysetById = (studysetId?: string, nested?: boolean) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        StudysetReturn,
        [string, string | undefined, boolean | undefined]
    >(
        [STUDYSET_QUERY_STRING, studysetId, nested],
        () => API.NeurostoreServices.StudySetsService.studysetsIdGet(studysetId || '', nested),
        {
            enabled: !!studysetId,
            onError: (err) => {
                enqueueSnackbar('there was an error retrieving the studyset', { variant: 'error' });
            },
            select: (res) => res.data,
        }
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

export default useGetStudysetById;
