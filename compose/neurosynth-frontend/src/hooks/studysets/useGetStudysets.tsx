import { Source, SearchCriteria } from 'pages/Studies/StudiesPage/models';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudysets = (
    searchCriteria: Partial<Omit<SearchCriteria, 'dataType'>>,
    enabled?: boolean
) => {
    return useQuery(
        ['studysets', { ...searchCriteria }],
        () => {
            return API.NeurostoreServices.StudySetsService.studysetsGet(
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
                searchCriteria.source === Source.ALL ? undefined : searchCriteria.source,
                searchCriteria.authorSearch,
                searchCriteria.userId
            );
        },
        {
            enabled,
            select: (axiosResponse) => {
                if (axiosResponse?.data?.results) {
                    axiosResponse.data.results.sort((a, b) => {
                        const firstStudysetId = a.id as string;
                        const secondStudysetId = b.id as string;
                        return firstStudysetId.localeCompare(secondStudysetId);
                    });
                }
                return axiosResponse.data;
            },
        }
    );
};

export default useGetStudysets;
