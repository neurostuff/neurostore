import { AxiosResponse } from 'axios';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetAnalysisById = (analysisId: string | undefined) => {
    return useQuery(
        ['analyses', analysisId],
        () => API.NeurostoreServices.AnalysesService.analysesIdGet(analysisId || '', false),
        {
            select: (res: AxiosResponse<AnalysisReturn>) => res.data,
            enabled: !!analysisId,
        }
    );
};

export default useGetAnalysisById;
