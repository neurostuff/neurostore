import { addKVPToSearch, getSearchCriteriaFromURL, getURLFromSearchCriteria } from 'components/Search/search.helpers';
import useGetDebouncedStudies from 'hooks/studies/useGetDebouncedStudies';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchCriteria } from 'pages/Study/Study.types';
import { AxiosError } from 'axios';

const STUDIES_BASE_PATH = '/base-studies';

const getErrorMessage = (err: unknown): string | undefined => {
    const axiosErr = err as AxiosError<{
        detail?: { errors?: { error: string }[]; message?: string };
    }>;
    if (axiosErr.response?.status === 400 && axiosErr.response?.data?.detail?.message) {
        return axiosErr.response.data.detail.message;
    }
    return 'There was an error searching for studies. (Is the query well formed?)';
};

const useSearchStudies = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const searchCriteria = useMemo(() => {
        return {
            ...new SearchCriteria(),
            ...getSearchCriteriaFromURL(location?.search),
        };
    }, [location?.search]);

    const [studyData, setStudyData] = useState<BaseStudyList>();

    const {
        data,
        isLoading: debouncedStudiesLoading,
        isRefetching,
        isError,
        error,
    } = useGetDebouncedStudies(searchCriteria, true);

    useEffect(() => {
        if (data) setStudyData(data);
    }, [data]);

    const errorMessage = isError && error ? getErrorMessage(error) : undefined;

    const handleSearch = (searchArgs: Partial<SearchCriteria>) => {
        const searchURL = getURLFromSearchCriteria(searchArgs);
        navigate(`${STUDIES_BASE_PATH}?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        navigate(`${STUDIES_BASE_PATH}?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        navigate(`${STUDIES_BASE_PATH}?${searchURL}`);
    };

    return {
        studyData,
        isLoading: debouncedStudiesLoading || isRefetching,
        error: errorMessage,
        handleSearch,
        handlePageChange,
        handleRowsPerPageChange,
        ...searchCriteria,
    };
};

export default useSearchStudies;
