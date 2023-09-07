import { SearchCriteria, SearchDataType, SortBy } from 'pages/Studies/StudiesPage/models';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetBaseStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    return useQuery(
        ['studies', { ...searchCriteria }],
        () => {
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
                searchCriteria.publicationSearch || undefined,
                searchCriteria.pmid,
                searchCriteria.doi,
                searchCriteria.flat,
                searchCriteria.info
            );
        },
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
