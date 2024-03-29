import { AxiosResponse } from 'axios';
import { ProjectList } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import { ProjectSearchCriteria, projectsSearchHelper } from './useGetProjects';

let debounce: NodeJS.Timeout;
const useGetDebouncedProjects = (
    projectsearchCriteria: Partial<ProjectSearchCriteria>,
    enabled?: boolean
) => {
    return useQuery(
        ['projects', { ...projectsearchCriteria }],
        () => {
            if (debounce) clearTimeout(debounce);

            return new Promise<AxiosResponse<ProjectList>>((resolve, reject) => {
                debounce = setTimeout(async () => {
                    try {
                        const res = await projectsSearchHelper(projectsearchCriteria);
                        resolve(res);
                    } catch (e) {
                        reject(e);
                    }
                }, 500);
            });
        },
        {
            enabled,
            select: (res) => {
                const projectsList = res.data;
                return projectsList;
            },
        }
    );
};

export default useGetDebouncedProjects;
