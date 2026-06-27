import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';

const useGetBaseStudyNonNestedById = (baseStudyId: string | undefined) => {
    const query = studyQueries.baseStudies.byIdNonNested(baseStudyId);
    return useQuery({
        ...query,
    });
};

export default useGetBaseStudyNonNestedById;
