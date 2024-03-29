import { SearchCriteria, SearchDataType, SortBy } from 'pages/Studies/StudiesPage/models';
import { useQuery } from 'react-query';
import API from 'utils/api';

export const baseStudiesSearchHelper = (searchCriteria: Partial<SearchCriteria>) => {
    return API.NeurostoreServices.BaseStudiesService.baseStudiesGet(
        searchCriteria.genericSearchStr || undefined,
        searchCriteria.sortBy === SortBy.RELEVANCE ? undefined : searchCriteria.sortBy,
        searchCriteria.pageOfResults,
        searchCriteria.descOrder,
        searchCriteria.pageSize,
        searchCriteria.nameSearch || undefined,
        searchCriteria.descriptionSearch || undefined,
        searchCriteria.authorSearch || undefined,
        searchCriteria.level,
        searchCriteria.dataType === SearchDataType.ALL ? 'both' : searchCriteria.dataType,
        searchCriteria.journalSearch || undefined,
        searchCriteria.pmid,
        searchCriteria.doi,
        searchCriteria.flat,
        searchCriteria.info
    );
};

const useGetBaseStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    return useQuery(
        ['studies', { ...searchCriteria }],
        () => baseStudiesSearchHelper(searchCriteria),
        {
            enabled,
            select: (res) => {
                const studyList = res.data;
                return studyList;
            },
        }
    );
};

export default useGetBaseStudies;
