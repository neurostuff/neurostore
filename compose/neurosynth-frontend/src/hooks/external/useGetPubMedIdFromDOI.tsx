import axios, { AxiosError, AxiosResponse } from 'axios';
import { useMutation } from 'react-query';

/**
 * NOTE: this is a get request but we use useMutation so that we can query the data imperatively.
 * This means that there is no smart refetching
 * https://github.com/TanStack/query/discussions/3675
 */

export interface IESearchResult {
    esearchresult: {
        count: string;
        idlist: string[];
        retmax?: string;
        retstart?: string;
        errorlist?: {
            phrasesnotfound?: string[];
            fieldsnotfound?: string[];
        };
        translationset?: any[];
        querytranslation?: string;
    };
    header: {
        type: string;
        version: string;
    };
    status: string;
    responseDate: string;
}

const ESEARCH_UR = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_API_KEY = import.meta.env.VITE_APP_PUBMED_API_KEY as string;

const useGetPubMedIdFromDOI = () => {
    return useMutation<AxiosResponse<IESearchResult>, AxiosError, string, unknown>((doi) =>
        axios.get<IESearchResult>(
            `${ESEARCH_UR}?db=pubmed&retmode=json&term=${doi}${PUBMED_API_KEY ? `&api_key=${PUBMED_API_KEY}` : ''}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
            }
        )
    );
};

export default useGetPubMedIdFromDOI;
