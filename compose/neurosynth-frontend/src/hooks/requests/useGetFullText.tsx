import axios from 'axios';
import { AxiosResponse } from 'axios';
import { useQuery } from 'react-query';

interface ISemanticScholarResponse {
    data: {
        externalIds: {
            CorpusId?: number;
            DOI?: string;
            PubMed?: string;
        }[];
        isOpenAccess: boolean;
        openAccessPdf: null | { status: string; url: string };
        paperId: string;
    }[];
}

const useGetFullText = (paperTitle: string) => {
    return useQuery(
        [paperTitle],
        () =>
            axios.get(
                `https://api.semanticscholar.org/graph/v1/paper/search?query=${paperTitle}&fields=isOpenAccess,openAccessPdf,externalIds&limit=1`
            ),
        {
            refetchOnWindowFocus: false,
            retry: 1,
            cacheTime: 120 * (60 * 1000), // 120 minutes
            staleTime: 100 * (60 * 1000), // 120 minutes
            select: (res: AxiosResponse<ISemanticScholarResponse>) => {
                const paperList = res.data.data || [];

                if (
                    paperList.length === 0 ||
                    !paperList[0].isOpenAccess ||
                    paperList[0].openAccessPdf === null ||
                    !paperList[0].openAccessPdf?.url
                ) {
                    return '';
                } else {
                    return paperList[0].openAccessPdf.url;
                }
            },
        }
    );
};

export default useGetFullText;
