import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { MetaAnalysisPostBody, MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import API from 'api/api.config';

const useUpdateMetaAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const updateMetaAnalysisMutation = useMutation<
        AxiosResponse<MetaAnalysisReturn>,
        AxiosError,
        {
            metaAnalysisId: string;
            metaAnalysis: Partial<MetaAnalysisPostBody>;
        },
        unknown
    >(
        (update) =>
            API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdPut(
                update.metaAnalysisId,
                update.metaAnalysis
            ),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('meta-analyses');
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the meta-analysis', {
                    variant: 'error',
                });
            },
        }
    );

    return updateMetaAnalysisMutation;
};

export default useUpdateMetaAnalysis;
