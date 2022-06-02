import { SearchCriteria } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudies = (searchCriteria: SearchCriteria) => {
    return useQuery(
        ['studies', searchCriteria?.userId],
        () =>
            API.NeurostoreServices.StudiesService.studiesGet(
                searchCriteria.genericSearchStr,
                searchCriteria.sortBy,
                searchCriteria.pageOfResults,
                searchCriteria.descOrder,
                searchCriteria.pageSize,
                searchCriteria.isNested,
                searchCriteria.nameSearch,
                searchCriteria.descriptionSearch,
                undefined,
                searchCriteria.showUnique,
                searchCriteria.source,
                searchCriteria.authorSearch,
                searchCriteria.userId
            ),
        {
            select: (res) => res.data.results,
        }
    );
};

export default useGetStudies;
