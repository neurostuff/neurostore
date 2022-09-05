import { SearchCriteria } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudies = (enabled: boolean, searchCriteria: Partial<SearchCriteria>) => {
    return useQuery(
        [
            'studies',
            {
                genericSearchStr: searchCriteria?.genericSearchStr,
                sortBy: searchCriteria?.sortBy,
                pageOfResults: searchCriteria.pageOfResults,
                descOrder: searchCriteria?.descOrder,
                pageSize: searchCriteria?.pageSize,
                isNested: searchCriteria?.isNested,
                nameSearch: searchCriteria?.nameSearch,
                descriptionSearch: searchCriteria?.descriptionSearch,
                showUnique: searchCriteria?.showUnique,
                source: searchCriteria?.source,
                authorSearch: searchCriteria?.authorSearch,
                userId: searchCriteria?.userId,
            },
        ],
        () =>
            API.NeurostoreServices.StudiesService.studiesGet(
                searchCriteria.genericSearchStr || undefined,
                searchCriteria.sortBy,
                searchCriteria.pageOfResults,
                searchCriteria.descOrder,
                searchCriteria.pageSize,
                searchCriteria.isNested,
                searchCriteria.nameSearch || undefined,
                searchCriteria.descriptionSearch || undefined,
                undefined,
                searchCriteria.showUnique,
                searchCriteria.source,
                searchCriteria.authorSearch || undefined,
                searchCriteria.userId
            ),
        {
            refetchOnWindowFocus: enabled,
            refetchOnMount: enabled,
            refetchOnReconnect: enabled,
            enabled: enabled,
            select: (res) => res.data,
        }
    );
};

export default useGetStudies;
