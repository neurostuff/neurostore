import { AxiosError, AxiosResponse } from 'axios';
import { ConditionRequest, ConditionReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useCreateCondition = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<ConditionReturn>, AxiosError, ConditionRequest, unknown>(
        (condition) => API.NeurostoreServices.ConditionsService.conditionsPost(condition),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(analysisQueries.conditions.all().queryKey);
            },
        }
    );
};

export default useCreateCondition;
