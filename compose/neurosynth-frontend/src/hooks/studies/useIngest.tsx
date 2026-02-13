import { AxiosError, AxiosResponse } from 'axios';
import { BaseStudiesPost200Response, BaseStudiesPostRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

// This API call to the POST /base-studies endpoint does our ingestion step (previously this was handled in the FE 1 API call at a time)
// Given a list of stubs, the BE either (1) returns all version of a matching base-study for the given stub or (2) creates a new /base-study
const useIngest = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<BaseStudiesPost200Response>, AxiosError, BaseStudiesPostRequest, unknown>(
        (stubs) => API.NeurostoreServices.BaseStudiesService.baseStudiesPost(stubs),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('studies');
            },
            onError: () => {
                enqueueSnackbar('There was an error during ingestion', { variant: 'error' });
            },
        }
    );
};

export default useIngest;
