import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { StudyRequest, StudyReturn } from 'neurostore-typescript-sdk';
import API from 'api/api.config';
import studyQueries from 'hooks/studies/studyQueries';
import { StudyReturnNonNested } from 'hooks/studies/studyQueries.types';

const useUpdateStudy = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<StudyReturn>,
        AxiosError,
        {
            studyId: string;
            study: StudyRequest;
        },
        unknown
    >({
        mutationFn: (args) => API.NeurostoreServices.StudiesService.studiesIdPut(args.studyId, args.study),
        onSuccess: (res) => {
            const typedRes = res.data as StudyReturnNonNested;
            const detailQueryKey = studyQueries.studies.byIdNonNested(typedRes.id).queryKey;
            const existingCached = queryClient.getQueryData(detailQueryKey) as StudyReturn;
            if (existingCached) {
                queryClient.setQueryData(detailQueryKey, {
                    ...existingCached,
                    ...res.data,
                });
            }

            queryClient.invalidateQueries(studyQueries.studies.lists());
            queryClient.invalidateQueries(studyQueries.baseStudies.lists());
        },
        onError: () => {
            enqueueSnackbar('there was an error updating the study', { variant: 'error' });
        },
    });
};

export default useUpdateStudy;
