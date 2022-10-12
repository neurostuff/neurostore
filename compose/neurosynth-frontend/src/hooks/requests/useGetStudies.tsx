import { SearchCriteria } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    return useQuery(
        ['studies', { ...searchCriteria }],
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
                searchCriteria.userId,
                searchCriteria.dataType,
                searchCriteria.studysetOwner || undefined
            ),
        {
            enabled,
            select: (res) => {
                const studyList = res.data;
                // sort studysets
                (studyList.results || [])?.forEach((study) => {
                    (study.studysets || []).sort((a, b) => {
                        const firstStudysetId = a.name as string;
                        const secondStudysetId = b.name as string;

                        return firstStudysetId.localeCompare(secondStudysetId);
                    });
                });

                return studyList;
            },
        }
    );
};

export default useGetStudies;
