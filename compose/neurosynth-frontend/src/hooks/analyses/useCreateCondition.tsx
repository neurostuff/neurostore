import { AxiosError, AxiosResponse } from 'axios';
import { ConditionRequest, ConditionReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useCreateCondition = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<ConditionReturn>, AxiosError, ConditionRequest, unknown>({
        mutationFn: (condition) => API.NeurostoreServices.ConditionsService.conditionsPost(condition),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['conditions']
            });
        }
    });
};

export default useCreateCondition;
