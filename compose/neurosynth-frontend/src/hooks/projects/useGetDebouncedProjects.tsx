import useDebounced from 'hooks/useDebounce';
import { useQuery } from 'react-query';
import { ProjectSearchCriteria, projectsSearchHelper } from './useGetProjects';
import { useMemo } from 'react';

const useGetDebouncedProjects = (
    projectsearchCriteria: Partial<ProjectSearchCriteria>,
    userId?: string,
    enabled?: boolean
) => {
    const stableArgs = useMemo(() => ({ projectsearchCriteria, userId }), [projectsearchCriteria, userId]);
    const debouncedSearchCriteria = useDebounced(stableArgs, 300);

    return useQuery(
        ['projects', debouncedSearchCriteria.projectsearchCriteria, debouncedSearchCriteria.userId],
        () => projectsSearchHelper(debouncedSearchCriteria.projectsearchCriteria, debouncedSearchCriteria.userId),
        {
            enabled,
            select: (res) => {
                const projectsList = res.data;
                return projectsList;
            },
            refetchOnWindowFocus: false,
        }
    );
};

export default useGetDebouncedProjects;
