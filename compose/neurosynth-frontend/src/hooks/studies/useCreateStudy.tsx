import API from 'api/api.config';
import { StudyRequest, StudyReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import studyQueries from 'hooks/studies/studyQueries';
import { StudyReturnNested } from './studyQueries.types';

/**
 * The useCreateStudy hook creates a new study based on an existing stub, essentially
 * acting as a clone operation. Study data can be passed in as a StudyRequest object
 * so that the new study is cloned with updated data
 */

const useCreateStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<StudyReturnNested>, AxiosError, { sourceId: string; data: StudyRequest }, unknown>(
        {
            mutationFn: ({ sourceId, data }) =>
                API.NeurostoreServices.StudiesService.studiesPost(undefined, sourceId, data) as Promise<
                    AxiosResponse<StudyReturnNested>
                >,

            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: studyQueries.studies.all(),
                });
            },

            onError: () => {
                enqueueSnackbar('There was an error creating the study', { variant: 'error' });
            },
        }
    );
};

export default useCreateStudy;
