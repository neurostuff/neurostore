import { useQuery } from 'react-query';
import API from 'utils/api';

interface IGetStudysetArgs {
    search?: string;
    sort?: string;
    page?: number;
    desc?: boolean;
    pageSize?: number;
    nested?: boolean;
    name?: string;
    description?: string;
    sourceId?: string;
    unique?: boolean;
    source?: 'neurostore' | 'neurovault' | 'pubmed' | 'neurosynth' | 'neuroquery';
    authors?: string;
    userId?: string;
}

const useGetStudysets = (getStudysetArgs: IGetStudysetArgs) => {
    return useQuery(
        ['studysets', getStudysetArgs.userId],
        () =>
            API.NeurostoreServices.StudySetsService.studysetsGet(
                getStudysetArgs.search,
                getStudysetArgs.sort,
                getStudysetArgs.page,
                getStudysetArgs.desc,
                getStudysetArgs.pageSize,
                getStudysetArgs.nested,
                getStudysetArgs.name,
                getStudysetArgs.description,
                getStudysetArgs.sourceId,
                getStudysetArgs.unique,
                getStudysetArgs.source,
                getStudysetArgs.authors,
                getStudysetArgs.userId
            ),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return res.sort((a, b) => {
                    const firstStudysetId = a.id as string;
                    const secondStudysetId = b.id as string;
                    return firstStudysetId.localeCompare(secondStudysetId);
                });
            },
        }
    );
};

export default useGetStudysets;
