import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';

const useGetBaseStudyInfoById = (baseStudyId: string | undefined) => {
    const query = studyQueries.baseStudies.byIdInfo(baseStudyId);
    return useQuery({
        ...query,
    });
};

export default useGetBaseStudyInfoById;
