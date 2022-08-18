import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudysetById = (studysetId: string) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, isLoading, isError, error } = useQuery(
        ['studysets', studysetId],
        () => API.NeurostoreServices.StudySetsService.studysetsIdGet(studysetId, true),
        {
            onError: () => {
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
