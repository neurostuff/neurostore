import axios from 'axios';
import { useMutation } from 'react-query';
import { parser, parseXMLPubmedArticle } from './useFetchPubMedIds.helpers';
import {
    EFETCH_URL,
    IArticleListFromPubmed,
    PUBMED_API_KEY,
    PUBMED_MAX_IDS_PER_REQUEST,
} from './useFetchPubMedIds.types';

const useFetchPubMedIds = () => {
    return useMutation({
        mutationFn: async (pubmedIds: string[]) => {
            if (pubmedIds.length > PUBMED_MAX_IDS_PER_REQUEST || pubmedIds.length === 0) return [];

            // adds a comma in between each id except for the last one
            const commaSeparatedIds = pubmedIds.join(',');

            const res = await axios.post(
                `${EFETCH_URL}`,
                `db=pubmed&rettype=abstract&retmode=xml&retmax=${PUBMED_MAX_IDS_PER_REQUEST}&id=${commaSeparatedIds}${
                    PUBMED_API_KEY ? `&api_key=${PUBMED_API_KEY}` : ''
                }`
            );

            if (!res.data) return [];
            const withoutItalics = (res.data as string).replaceAll(/<\/?i>/g, '');
            const parsedJSON = parser.parse(withoutItalics) as IArticleListFromPubmed;

            const articleList = parsedJSON?.PubmedArticleSet?.PubmedArticle;
            if (!articleList) return [];

            return articleList.map((pubmedArticle) => parseXMLPubmedArticle(pubmedArticle));
        },
    });
};

export default useFetchPubMedIds;
