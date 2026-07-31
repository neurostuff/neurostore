import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useDeleteMetaAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse, AxiosError, string, unknown>({
        mutationFn: (id) => API.NeurosynthServices.NeurosynthDefaultApi.metaAnalysesIdDelete(id),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['meta-analyses']
            });
        },

        onError: () => {
            enqueueSnackbar('There was an error deleting the meta-analysis', {
                variant: 'error',
            });
        }
    });
};

export default useDeleteMetaAnalysis;
