import useDebounced from 'hooks/useDebounce';
import studyQueries from 'hooks/studies/studyQueries';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useQuery } from 'react-query';
import { useMemo } from 'react';

const useGetDebouncedBaseStudiesNested = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    const stableArgs = useMemo(() => searchCriteria, [searchCriteria]);
    const debouncedSearchCriteria = useDebounced(stableArgs, 300);

    const query = studyQueries.baseStudies.debouncedSearchNested(debouncedSearchCriteria);

    return useQuery({
        ...query,
        enabled,
        refetchOnWindowFocus: false,
    });
};

export default useGetDebouncedBaseStudiesNested;
