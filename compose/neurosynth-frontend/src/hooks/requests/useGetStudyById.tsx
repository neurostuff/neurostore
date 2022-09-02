import { useQuery } from 'react-query';
import API, { AnalysisApiResponse } from 'utils/api';

const useGetStudyById = (studyId: string) => {
    const { data, isLoading, isError, error } = useQuery(
        ['studies', studyId],
        () => API.NeurostoreServices.StudiesService.studiesIdGet(studyId, true),
        {
            select: (res) => {
                const analyses = res.data.analyses as AnalysisApiResponse[];

                const sortedAnalyses = (analyses || []).sort((a, b) => {
                    const dateA = Date.parse(a.created_at || '');
                    const dateB = Date.parse(b.created_at || '');
                    if (isNaN(dateA) || isNaN(dateB)) return 0;

                    return dateB - dateA;
                });

                res.data.analyses = sortedAnalyses;
                return res.data;
            },
            staleTime: Infinity,
        }
    );

    return {
        data,
        isLoading,
        isError,
        error,
    };
};

export default useGetStudyById;
