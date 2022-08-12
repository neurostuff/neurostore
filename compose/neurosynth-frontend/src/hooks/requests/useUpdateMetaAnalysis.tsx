import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { MetaAnalysisPostBody, MetaAnalysisReturn } from '../../neurosynth-compose-typescript-sdk';
import API from '../../utils/api';

const useUpdateMetaAnalysis = () => {
    const queryClient = useQueryClient();
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
        }
    );

    return updateMetaAnalysisMutation;
};

export default useUpdateMetaAnalysis;
