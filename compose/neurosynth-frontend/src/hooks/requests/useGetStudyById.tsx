import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudyById = (studyId: string) => {
    return useQuery(
        ['studies', studyId],
        () => API.NeurostoreServices.StudiesService.studiesIdGet(studyId, true),
        {
            select: (res) => {
                const analyses = res.data.analyses as AnalysisReturn[];

                const sortedAnalyses = (analyses || []).sort((a, b) => {
                    const dateA = Date.parse(a.created_at || '');
                    const dateB = Date.parse(b.created_at || '');
                    if (isNaN(dateA) || isNaN(dateB)) return 0;

                    return dateB - dateA;
                });

                res.data.analyses = sortedAnalyses;
                return res.data;
            },
        }
    );
};

export default useGetStudyById;
