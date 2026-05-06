import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';

const useGetBaseStudyNestedById = (baseStudyId: string | undefined) => {
    const query = studyQueries.baseStudies.byIdNested(baseStudyId);
    return useQuery({
        ...query,
    });
};

export default useGetBaseStudyNestedById;
