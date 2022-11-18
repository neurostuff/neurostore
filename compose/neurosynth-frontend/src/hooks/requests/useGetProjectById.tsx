import { useQuery } from 'react-query';
import { IProject } from './useGetProjects';

const useGetProjectById = (projectId: string) => {
    return useQuery(['projects', projectId], () => {
        const x = new Promise<IProject>((res, rej) => {
            const tempProj: IProject = {
                id: '2giubg3igube',
                name: 'my project',
                description: 'my project description',
                provenance: {},
                studysetId: null,
                metaAnalysisId: null,
            };
            res(tempProj);
        });

        return x;
    });
};

export default useGetProjectById;
