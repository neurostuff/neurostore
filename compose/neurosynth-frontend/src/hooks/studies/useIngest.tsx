import { AxiosError, AxiosResponse } from 'axios';
import { BaseStudiesPost200Response, BaseStudiesPostRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

/**
 * This API call to the POST /base-studies endpoint does our ingestion step (previously this was handled in the FE 1 API call at a time)
 * Given a list of stubs, the BE either (1) returns all version of a matching base-study for the given stub or (2) creates a new /base-study
 *
 * NOTE: As described by https://github.com/neurostuff/neurostore/issues/1687, if the post request is made with studies that include
 * nested analysis points/images, then it's possible for the flags has_images, has_coordinates, has_* to be inccorect as those flags
 * are computed asynchronously. For now, none of the frontend does nested overwrites, but if that changes, we should fix 1687.
 */
const useIngest = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<BaseStudiesPost200Response>, AxiosError, BaseStudiesPostRequest, unknown>({
        mutationFn: (stubs) => API.NeurostoreServices.BaseStudiesService.baseStudiesPost(stubs),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['studies'],
            });
        },

        onError: () => {
            enqueueSnackbar('There was an error during ingestion', { variant: 'error' });
        },
    });
};

export default useIngest;
