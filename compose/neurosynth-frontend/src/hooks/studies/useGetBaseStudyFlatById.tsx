import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';

const useGetBaseStudyFlatById = (baseStudyId: string | undefined) => {
    const query = studyQueries.baseStudies.byIdFlat(baseStudyId);
    return useQuery({
        ...query,
    });
};

export default useGetBaseStudyFlatById;
