import { useQuery } from '@tanstack/react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useGetAnalysesByStudyId = (studyId: string | undefined) => {
    return useQuery(analysisQueries.analyses.byStudyId(studyId));
};

export default useGetAnalysesByStudyId;
