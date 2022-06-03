import { AxiosError, AxiosResponse } from 'axios';
import { Studyset, StudysetReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<StudysetReturn>, AxiosError, Studyset, unknown>(
        (studyset: Studyset) => API.NeurostoreServices.StudySetsService.studysetsPost(studyset),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries('studysets');
            },
        }
    );
};

export default useCreateStudyset;
