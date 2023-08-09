import axios, { AxiosError, AxiosResponse } from 'axios';
import { useQueries, UseQueryOptions } from 'react-query';
import * as fxparser from 'fast-xml-parser';
import { INeurosynthParsedPubmedArticle, IArticleListFromPubmed } from './models';
import {
    EFETCH_URL,
    PUBMED_ARTICLE_URL_PREFIX,
    extractAbstractHelper,
    extractAuthorsHelper,
    extractDOIHelper,
    extractKeywordsHelper,
    extractPMIDHelper,
    extractTitleHelper,
    hexCodeToHTMLEntity,
} from 'hooks/external/utils';
const { XMLParser } = fxparser;

const parser = new XMLParser({
    ignoreAttributes: false,
    ignoreDeclaration: true,
    tagValueProcessor(tagName, tagValue, jPath, hasAttributes, isLeafNode) {
        // by default, pubmed gives us hex codes in the XML for special characters. We need to modify them here
        if (
            isLeafNode &&
            (tagName === 'LastName' ||
                tagName === 'ForeName' ||
                tagName === 'Initials' ||
                tagName === 'Keyword' ||
                tagName === 'ArticleTitle' ||
                tagName === 'Title' || // journal title
                tagName === 'AbstractText')
        ) {
            return hexCodeToHTMLEntity(tagValue);
        }
    },
    isArray(tagName, jPath, isLeafNode, isAttribute) {
        return [
            `PubmedArticleSet.PubmedArticle.MedlineCitation.Article.AuthorList.Author`,
            `PubmedArticleSet.PubmedArticle`,
            `PubmedArticleSet.PubmedArticle.PubmedData.ArticleIdList.ArticleId`,
            `PubmedArticleSet.PubmedArticle.MedlineCitation.Article.Abstract.AbstractText`,
            `PubmedArticleSet.PubmedArticle.MedlineCitation.KeywordList.Keyword`,
        ].includes(jPath);
    },
});

const getQueryFn = (ids: string, startIndex: number) =>
    axios.post(
        `${EFETCH_URL}`,
        `db=pubmed&rettype=abstract&retmode=xml&retmax=500&retstart=${startIndex}&id=${ids}`,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
        }
    );

const splitIdsIntoSeparateRequests = (
    pubmedIds: string[]
): UseQueryOptions<
    AxiosResponse<any>,
    AxiosError<any>,
    INeurosynthParsedPubmedArticle[],
    ['pubmed', string, number]
>[] => {
    if (pubmedIds.length > 1500 || pubmedIds.length === 0) return [];

    // adds a comma in between each id except for the last one
    const appendedIdStr = pubmedIds.reduce(
        (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ','}`,
        ''
    );

    const queries: UseQueryOptions<
        AxiosResponse<any>,
        AxiosError<any>,
        INeurosynthParsedPubmedArticle[],
        ['pubmed', string, number]
    >[] = [];

    for (let i = 0; i < pubmedIds.length; i += 500) {
        queries.push({
            queryKey: ['pubmed', appendedIdStr, i],
            queryFn: ({ queryKey }) => getQueryFn(queryKey[1], queryKey[2]),
            enabled: pubmedIds.length > 0,
            select: (res) => {
                if (!res.data) return [];
                const withoutItalics = (res.data as string).replaceAll(/<\/?i>/g, '');
                const parsedJSON = parser.parse(withoutItalics) as IArticleListFromPubmed;

                if (!parsedJSON?.PubmedArticleSet?.PubmedArticle) return [];

                const articleList = parsedJSON.PubmedArticleSet.PubmedArticle;

                return articleList.map((article) => {
                    const pubmedArticleRef = article?.MedlineCitation?.Article;
                    const pubmedArticleIdRef = article?.PubmedData?.ArticleIdList;

                    const title = extractTitleHelper(pubmedArticleRef?.ArticleTitle);
                    const authors = extractAuthorsHelper(pubmedArticleRef?.AuthorList?.Author);
                    const doi = extractDOIHelper(pubmedArticleIdRef?.ArticleId);
                    const pmid = extractPMIDHelper(
                        article?.MedlineCitation?.PMID?.['#text'],
                        pubmedArticleIdRef?.ArticleId
                    );
                    const abstract = extractAbstractHelper(
                        pubmedArticleRef?.Abstract?.AbstractText
                    );
                    const year = (
                        pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year ||
                        pubmedArticleRef?.ArticleDate?.Year ||
                        0
                    )?.toString();
                    const keywords = extractKeywordsHelper(
                        article?.MedlineCitation?.KeywordList?.Keyword
                    );

                    return {
                        title: title,
                        authors: authors,
                        abstractText: abstract,
                        DOI: doi,
                        keywords: keywords,
                        PMID: pmid,
                        articleYear: year,
                        journal: {
                            title: pubmedArticleRef?.Journal?.Title || '',
                            volume: pubmedArticleRef?.Journal?.JournalIssue?.Volume || 0,
                            issue: pubmedArticleRef?.Journal?.JournalIssue?.Issue || 0,
                            date: {
                                year: (
                                    pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year || 0
                                ).toString(),
                                month:
                                    pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Month || '',
                            },
                        },
                        articleLink: `${PUBMED_ARTICLE_URL_PREFIX}${pmid}`,
                    } as INeurosynthParsedPubmedArticle;
                });
            },
        });
    }

    return queries;
};

const useGetPubmedIDs = (pubmedIds: string[]) => {
    // the pubmed API only supports 500 ids per request and only 3 requests per second.
    // TODO: for those with a valid API key, this increases to 10 requests per second. We should
    // allow the user to optionally include an API key.
    const requests = splitIdsIntoSeparateRequests(pubmedIds);

    return useQueries(requests);
};

export default useGetPubmedIDs;
