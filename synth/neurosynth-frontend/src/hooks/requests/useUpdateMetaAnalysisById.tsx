import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { MetaAnalysisPostBody, MetaAnalysisReturn } from '../../neurosynth-compose-typescript-sdk';
import API from '../../utils/api';

const useUpdateMetaAnalysisById = () => {
    const queryClient = useQueryClient();
    const updateMetaAnalysisMutation = useMutation<
        AxiosResponse<MetaAnalysisReturn>,
        AxiosError,
        {
            metaAnalysisId: string;
            metaAnalysis: MetaAnalysisPostBody;
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

export default useUpdateMetaAnalysisById;
