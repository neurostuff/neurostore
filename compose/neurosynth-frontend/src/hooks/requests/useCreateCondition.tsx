import { AxiosError, AxiosResponse } from 'axios';
import { Condition, ConditionReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateCondition = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<ConditionReturn>, AxiosError, Condition, unknown>(
        (condition) => API.NeurostoreServices.ConditionsService.conditionsPost(condition),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('conditions');
            },
        }
    );
};

export default useCreateCondition;
