import studyQueries from 'hooks/studies/studyQueries';
import { useQuery } from 'react-query';

const useGetStudyNestedById = (studyId: string | undefined) => {
    const query = studyQueries.studies.byIdNested(studyId);
    return useQuery({
        ...query,
        select: (study) => {
            const analyses = study.analyses ?? [];

            const sortedAnalyses = [...analyses].sort((a, b) => {
                return (a.name || '').localeCompare(b.name || '');
            });

            return { ...study, analyses: sortedAnalyses };
        },
        onError: (err: unknown) => {
            console.log(err);
        },
    });
};

export default useGetStudyNestedById;
