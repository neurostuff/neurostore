import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';
import { StudyReturnNonNested } from './studyQueries.types';
import { AxiosError } from 'axios';

const useGetStudyNonNestedById = (studyId: string | undefined) => {
    const query = studyQueries.studies.byIdNonNested(studyId);
    return useQuery<Promise<StudyReturnNonNested>, AxiosError, StudyReturnNonNested, typeof query.queryKey>({
        ...query,
        onError: (err: unknown) => {
            console.log(err);
        },
    });
};

export default useGetStudyNonNestedById;
