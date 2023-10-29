import { Source, SearchCriteria } from 'pages/Studies/StudiesPage/models';
import { useQuery } from 'react-query';
import API from 'utils/api';

export const STUDYSET_QUERY_STRING = 'studysets';

const useGetStudysets = (
    searchCriteria: Partial<Omit<SearchCriteria, 'dataType'>>,
    enabled?: boolean
) => {
    return useQuery(
        [STUDYSET_QUERY_STRING, { ...searchCriteria }],
        () => {
            return API.NeurostoreServices.StudySetsService.studysetsGet(
                undefined,
                searchCriteria.sortBy,
                searchCriteria.pageOfResults,
                searchCriteria.descOrder,
                searchCriteria.pageSize,
                searchCriteria.isNested,
                searchCriteria.genericSearchStr,
                undefined,
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
