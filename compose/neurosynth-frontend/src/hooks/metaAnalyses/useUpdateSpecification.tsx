import { AxiosError, AxiosResponse } from 'axios';
import { SpecificationPostBody, SpecificationReturn } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useUpdateSpecification = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<SpecificationReturn>,
        AxiosError,
        { specificationId: string; specification: SpecificationPostBody },
        unknown
    >({
        mutationFn: (args) => {
            return API.NeurosynthServices.SpecificationsService.specificationsIdPut(
                args.specificationId,
                args.specification
            );
        },

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['specifications']
            });
            enqueueSnackbar('specification updated successfully', { variant: 'success' });
        },

        onError: () => {
            enqueueSnackbar('there was an error updating the specification', {
                variant: 'error',
            });
        }
    });
};

export default useUpdateSpecification;
