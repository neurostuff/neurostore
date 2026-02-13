import { AxiosError, AxiosResponse } from 'axios';
import { StudysetRequest, StudysetReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import { STUDYSET_QUERY_STRING } from './useGetStudysetById';

const useCreateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<StudysetReturn>, AxiosError, StudysetRequest, unknown>(
        (studyset) => API.NeurostoreServices.StudySetsService.studysetsPost(undefined, undefined, undefined, studyset),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries(STUDYSET_QUERY_STRING);
            },
        }
    );
};

export default useCreateStudyset;
