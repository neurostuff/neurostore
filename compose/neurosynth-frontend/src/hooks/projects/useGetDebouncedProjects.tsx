import { useQuery } from '@tanstack/react-query';
import { ProjectSearchCriteria, projectsSearchHelper } from './useGetProjects';
import { useMemo } from 'react';
import useDebounced from 'hooks/useDebounce';

const useGetDebouncedProjects = (
    projectsearchCriteria: Partial<ProjectSearchCriteria>,
    userId?: string,
    enabled?: boolean
) => {
    const stableArgs = useMemo(() => ({ projectsearchCriteria, userId }), [projectsearchCriteria, userId]);
    const debouncedSearchCriteria = useDebounced(stableArgs, 300);

    return useQuery({
        queryKey: ['projects', debouncedSearchCriteria.projectsearchCriteria, debouncedSearchCriteria.userId],
        queryFn: () =>
            projectsSearchHelper(debouncedSearchCriteria.projectsearchCriteria, debouncedSearchCriteria.userId),
        enabled,
        select: (res) => {
            const projectsList = res.data;
            return projectsList;
        },
        refetchOnWindowFocus: false,
    });
};

export default useGetDebouncedProjects;
