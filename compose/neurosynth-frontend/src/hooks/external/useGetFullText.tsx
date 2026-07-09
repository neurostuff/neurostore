import axios from 'axios';
import { AxiosResponse } from 'axios';
import { useQuery } from 'react-query';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';
const SEMANTIC_SCHOLAR_API_KEY = (import.meta.env.VITE_APP_SEMANTIC_SCHOLAR_API_KEY as string | undefined)?.trim();

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

const useGetFullText = (paperTitle?: string | null) => {
    return useQuery(
        [paperTitle],
        () =>
            axios.get(
                `https://api.semanticscholar.org/graph/v1/paper/search?query=${paperTitle}&fields=isOpenAccess,openAccessPdf,externalIds&limit=1`,
                {
                    headers: SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': SEMANTIC_SCHOLAR_API_KEY } : undefined,
                }
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
            enabled: !!paperTitle && env !== 'DEV' && env !== 'STAGING',
        }
    );
};

export default useGetFullText;
