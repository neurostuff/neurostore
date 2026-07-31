import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from '@tanstack/react-query';

const useGetBaseStudyInfoById = (baseStudyId: string | undefined) => {
    return useQuery({
        ...studyQueries.baseStudies.byIdInfo(baseStudyId),
    });
};

export default useGetBaseStudyInfoById;
