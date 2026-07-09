import { useAuth0 } from '@auth0/auth0-react';
import useGetDebouncedProjects from 'hooks/projects/useGetDebouncedProjects';
import { ProjectSearchCriteria } from 'hooks/projects/useGetProjects';
import { ProjectList } from 'neurosynth-compose-typescript-sdk';
import { addKVPToSearch, getSearchCriteriaFromURL, getURLFromSearchCriteria } from 'components/Search/search.helpers';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const useSearchProjects = (userId?: string) => {
    const { isLoading, isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchCriteria, setSearchCriteria] = useState<ProjectSearchCriteria>({
        ...new ProjectSearchCriteria(),
        ...getSearchCriteriaFromURL(location?.search),
    });

    const [projectsResponse, setProjectsResponse] = useState<ProjectList>();

    const {
        data,
        isLoading: debouncedProjectIsLoading,
        isRefetching,
        isError,
    } = useGetDebouncedProjects({ ...searchCriteria }, userId, !isLoading && isAuthenticated);

    /**
     * the data variable itself is undefined when refetching, so we need to save it
     * in memory to create a more stable experience when changing search criteria.
     * This is especially noticable when paginating
     */
    useEffect(() => {
        if (data) setProjectsResponse(data);
    }, [data]);

    // runs every time the URL changes, to create a URL driven search.
    // this is separated from the debounce because otherwise the URL would
    // not update until the setTimeout is complete
    useEffect(() => {
        const urlSearchCriteria = getSearchCriteriaFromURL(location?.search);
        setSearchCriteria((prev) => {
            return { ...prev, ...urlSearchCriteria };
        });
    }, [location.search]);

    const handleSearch = (searchArgs: Partial<ProjectSearchCriteria>) => {
        // when we search, we want to reset the search criteria as we dont know the
        // page number of number of results in advance
        const searchURL = getURLFromSearchCriteria(searchArgs);
        navigate(`/projects?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        navigate(`/projects?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        navigate(`/projects?${searchURL}`);
    };

    return {
        projectsResponse,
        isLoading: isLoading || debouncedProjectIsLoading || isRefetching,
        isError,
        handleSearch,
        handlePageChange,
        handleRowsPerPageChange,
        ...searchCriteria,
    };
};

export default useSearchProjects;
