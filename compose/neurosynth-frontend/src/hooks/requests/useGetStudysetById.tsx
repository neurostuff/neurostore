import { AxiosError, AxiosResponse } from 'axios';
import { StudysetReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudysetById = (studysetId?: string, nested?: boolean) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, isLoading, isError, error } = useQuery<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        StudysetReturn,
        [string, string | undefined]
    >(
        ['studysets', studysetId],
        () =>
            API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId || '',
                nested === undefined ? true : nested
            ),
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
    };
};

export default useGetStudysetById;
