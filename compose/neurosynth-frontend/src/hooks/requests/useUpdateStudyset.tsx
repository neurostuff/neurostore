import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { Studyset, StudysetReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';

const useUpdateStudyset = () => {
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        {
            studysetId: string;
            studyset: Studyset;
        },
        unknown
    >(
        (args) =>
            API.NeurostoreServices.StudySetsService.studysetsIdPut(args.studysetId, args.studyset),
        {
            onSuccess: () => queryClient.invalidateQueries('studysets'),
        }
    );
};

export default useUpdateStudyset;
