import { AxiosResponse } from 'axios';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetAnalysisById = (analysisId: string | undefined) => {
    return useQuery({
        queryKey: ['analyses', analysisId],
        queryFn: () => API.NeurostoreServices.AnalysesService.analysesIdGet(analysisId || '', true),
        select: (res: AxiosResponse<AnalysisReturn>) => res.data,
        enabled: !!analysisId
    });
};

export default useGetAnalysisById;
