import useDebounced from 'hooks/useDebounce';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useQuery } from 'react-query';
import { baseStudiesSearchHelper } from './useGetBaseStudies';
import { useMemo } from 'react';

const useGetDebouncedStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    const stableArgs = useMemo(() => searchCriteria, [searchCriteria]);
    const debouncedSearchCriteria = useDebounced(stableArgs, 300);

    return useQuery(
        ['studies', debouncedSearchCriteria],
        () =>
            baseStudiesSearchHelper({
                ...debouncedSearchCriteria,
                flat: true,
                info: false,
            }),
        {
            enabled,
            select: (res) => res.data,
            refetchOnWindowFocus: false,
        }
    );
};

export default useGetDebouncedStudies;
