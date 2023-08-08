import { BaseStudyList } from 'neurostore-typescript-sdk';
import { SearchCriteria, SearchDataType, Source } from 'pages/Studies/StudiesPage/StudiesPage';
import { useQuery } from 'react-query';
import API from 'utils/api';

export type NeurosynthStudyList = BaseStudyList & { metadata: { total_count: number } };

const useGetStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    return useQuery(
        ['studies', { ...searchCriteria }],
        () => {
            return API.NeurostoreServices.BaseStudiesService.baseStudiesGet(
                searchCriteria.genericSearchStr || undefined,
                searchCriteria.sortBy,
                searchCriteria.pageOfResults,
                searchCriteria.descOrder,
                searchCriteria.pageSize,
                searchCriteria.nameSearch || undefined,
                searchCriteria.descriptionSearch || undefined,
                searchCriteria.authorSearch || undefined,
                searchCriteria.level,
                searchCriteria.dataType === SearchDataType.BOTH
                    ? undefined
                    : searchCriteria.dataType,
                searchCriteria.source === Source.ALL ? undefined : searchCriteria.source,
                undefined,
                searchCriteria.pmid,
                searchCriteria.doi,
                searchCriteria.flat,
                undefined
            );
        },
        {
            enabled,
            select: (res) => {
                const studyList = res.data as unknown as NeurosynthStudyList;
                return studyList;
            },
        }
    );
};

export default useGetStudies;
