import { AxiosError, AxiosResponse } from 'axios';
import { StudysetRequest, StudysetReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import studysetQueries from 'hooks/studysets/studysetQueries';

const useCreateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<StudysetReturn>, AxiosError, StudysetRequest, unknown>({
        mutationFn: (studyset) =>
            API.NeurostoreServices.StudySetsService.studysetsPost(undefined, undefined, undefined, studyset),
        onSuccess: () => {
            queryClient.invalidateQueries(studysetQueries.all());
        },
    });
};

export default useCreateStudyset;
