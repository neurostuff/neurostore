import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { MetaAnalysis, MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import API from 'api/api.config';

export const sanitizeMetaAnalysisPayload = (
    payload: Partial<MetaAnalysis>
): Partial<MetaAnalysis> => {
    const {
        studyset,
        annotation,
        snapshots,
        run_key,
        neurostore_analysis,
        neurostore_url,
        results,
        ...sanitized
    } = payload as Partial<Record<string, unknown>>;

    return sanitized as Partial<MetaAnalysis>;
};

const useUpdateMetaAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const updateMetaAnalysisMutation = useMutation<
        AxiosResponse<MetaAnalysisReturn>,
        AxiosError,
        {
            metaAnalysisId: string;
            metaAnalysis: Partial<MetaAnalysis>;
        },
        unknown
    >(
        (update) =>
            API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdPut(
                update.metaAnalysisId,
                sanitizeMetaAnalysisPayload(update.metaAnalysis)
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
