import { AxiosError, AxiosResponse } from 'axios';
import { StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import API from 'api/api.config';

export const STUDYSET_QUERY_STRING = 'studysets';

const useGetStudysetById = (studysetId?: string, nested?: boolean, summary?: boolean) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        StudysetReturn,
        [string, string | undefined, boolean | undefined, boolean | undefined]
    >(
        [STUDYSET_QUERY_STRING, studysetId, nested, summary],
        () =>
            API.NeurostoreServices.StudySetsService.studysetsIdGet(studysetId || '', nested, undefined, {
                params: {
                    summary: summary || undefined,
                },
            }),
        {
            enabled: !!studysetId,
            onError: () => {
                enqueueSnackbar('there was an error retrieving the studyset', { variant: 'error' });
            },
            select: (res) => {
                res.data.studies?.sort((a, b) => {
                    if (typeof a === 'string' && typeof b === 'string') {
                        return a.localeCompare(b);
                    } else {
                        const studyA = a as StudyReturn;
                        const studyB = b as StudyReturn;
                        return (studyA.name || '').localeCompare(studyB.name || '');
                    }
                });

                return res.data;
            },
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
