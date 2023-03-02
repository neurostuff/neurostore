import axios, { AxiosError, AxiosResponse } from 'axios';
import { QueryKey, useQueries, useQuery, UseQueryOptions } from 'react-query';
import * as fxparser from 'fast-xml-parser';
const { XMLParser } = fxparser;

type PubMedYN = 'Y' | 'N';

interface IPubMedArticleId {
    '#text'?: number | string;
    '@_IdType'?: 'pubmed' | 'doi' | 'pii' | 'pmc';
}

interface IPubmedAbstractText {
    '@_Label'?: string;
    '#text'?: string;
    i?: string | string[];
}

interface IPubmedAuthor {
    '@_CompleteYN'?: PubMedYN;
    AffiliationInfo?: {
        Affiliation?: string;
    };
    ForeName?: string;
    Initials?: string;
    LastName?: string;
}

interface IPubmedKeyword {
    '#text'?: string;
    '@_MajorTopicYN'?: PubMedYN;
}

interface IPubmedTitle {
    '#text'?: string;
    i: string;
}

interface IPubMedArticle {
    MedlineCitation?: {
        '@_IndexingMethod'?: string;
        '@_Owner'?: string;
        '@_Status'?: string;
        Article?: {
            '@_PubModel'?: string;
            Abstract?: {
                AbstractText?: string[] | IPubmedAbstractText[];
            };
            ArticleDate?: {
                '@_DateType'?: string;
                Year?: number;
                Month?: number;
                Day?: number;
            };
            ArticleTitle?: string | IPubmedTitle;
            AuthorList?: {
                '@_CompleteYN'?: PubMedYN;
                Author?: IPubmedAuthor[];
            };
            ELocationID?: {
                '#text'?: string;
                '@_EidType'?: string;
                '@_ValidYN'?: PubMedYN;
            };
            Journal?: {
                ISOAbbreviation?: string;
                ISSN?: {
                    '#text'?: string;
                    '@_IssnType'?: string;
                };
                JournalIssue?: {
                    '@_CitedMedium'?: string;
                    Issue?: number;
                    PubDate?: {
                        Year?: number;
                        Month?: string;
                    };
                    Volume?: number;
                };
                Title?: string;
            };
            Language?: string;
            Pagination?: {
                MedlinePgn?: string;
            };
            PublicationTypeList?: {
                PublicationType?: {
                    '#text'?: string;
                    '@_UI'?: string;
                }[];
            };
        };
        CitationSubset?: string;
        DateCompleted?: {
            Year?: number;
            Month?: number;
            Day?: number;
        };
        DateRevised?: {
            Year?: number;
            Month?: number;
            Day?: number;
        };
        KeywordList?: {
            '@_Owner'?: string;
            Keyword?: string[] | IPubmedKeyword[];
        };
        MedlineJournalInfo: {
            Country?: string;
            ISSNLinking?: string;
            MedlineTA?: string;
            NlmUniqueID?: number;
        };
        MeshHeadingList?: {
            MeshHeading?: {
                DescriptorName?: {
                    '#text'?: string;
                    '@_MajorTopicYN'?: PubMedYN;
                    '@_UI'?: string;
                };
                QualifierName?: {
                    '#text'?: string;
                    '@_MajorTopicYN'?: PubMedYN;
                    '@_UI'?: string;
                }[];
            }[];
        };
        PMID?: {
            '#text'?: number;
            '@_Version'?: string;
        };
    };
    PubmedData?: {
        ArticleIdList?: {
            ArticleId?: IPubMedArticleId[];
        };
        History: {
            PubMedPubDate: {
                '@_PubStatus': string;
                Year?: number;
                Month?: number;
                Day?: number;
            }[];
        };
        PublicationStatus?: string;
        ReferenceList?: {
            Reference?: {
                ArticleIdList?: {
                    ArticleId?: {
                        '#text': number;
                        '@_IdType': string;
                    };
                };
                Citation?: string;
            }[];
        };
    };
}

interface IArticleListFromPubmed {
    '?xml': {
        '@_version': string;
    };
    PubmedArticleSet?: {
        PubmedArticle?: IPubMedArticle[];
    };
}

export interface INeurosynthParsedPubmedArticle {
    title: string;
    keywords: string[];
    authors: {
        ForeName: string;
        Initials: string;
        LastName: string;
    }[];
    abstractText: string;
    DOI: string;
    PMID: string;
    articleYear: string | undefined;
    journal: {
        title: string;
        volume: number;
        issue: number;
        date: {
            year: string;
            month: string;
        };
    };
    articleLink: string;
}

const extractAuthorsHelper = (authors: IPubmedAuthor[] | undefined): IPubmedAuthor[] => {
    const authorList = authors || [];
    return authorList.map((author) => ({
        ForeName: author?.ForeName || '',
        Initials: author?.Initials || '',
        LastName: author?.LastName || '',
    }));
};

const extractDOIHelper = (articleIds: IPubMedArticleId[] | undefined): string => {
    const articleIdList = articleIds || [];

    const doiArticleId = articleIdList.find(
        (article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'doi'
    );
    const extractedDOI = doiArticleId?.['#text'];
    if (!doiArticleId || !extractedDOI) return '';

    return typeof extractedDOI === 'number' ? extractedDOI.toString() : extractedDOI;
};

const extractPMIDHelper = (
    medlineCitationPmid: string | undefined | number,
    articleIds: IPubMedArticleId[] | undefined
): string => {
    if (medlineCitationPmid) return medlineCitationPmid.toString();

    const articleIdList = articleIds || [];

    const pmidArticleId = articleIdList.find(
        (article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'pubmed'
    );
    const extractedPMID = pmidArticleId?.['#text'];
    if (!pmidArticleId || !extractedPMID) return '';

    return typeof extractedPMID === 'number' ? extractedPMID.toString() : extractedPMID;
};

const extractAbstractHelper = (
    abstractTextSections: string[] | IPubmedAbstractText[] | undefined
): string => {
    if (!abstractTextSections || abstractTextSections.length === 0) return '';

    if (typeof abstractTextSections[0] === 'string') {
        return (abstractTextSections as string[]).reduce((acc, curr) => `${acc}\n${curr}`, '');
    } else {
        return (abstractTextSections as IPubmedAbstractText[]).reduce(
            (acc, curr) => `${acc}${curr['@_Label'] || ''}\n${curr['#text'] || ''}\n`,
            ''
        );
    }
};

const extractKeywordsHelper = (keywords: string[] | IPubmedKeyword[] | undefined): string[] => {
    if (!keywords || keywords.length === 0) return [];

    if (typeof keywords[0] === 'string') {
        return keywords as string[];
    } else {
        return (keywords as IPubmedKeyword[]).map((x) => x?.['#text'] || '') as string[];
    }
};

const extractTitleHelper = (title: string | IPubmedTitle | undefined): string => {
    if (typeof title === 'string') {
        return title;
    } else if (typeof title === 'object') {
        return title['#text'] || '';
    } else {
        return '';
    }
};

// we take advantage of the HTML Entities already encoded to convert: https://www.w3.org/TR/html4/sgml/entities.html
const hexCodeToHTMLEntity = (hexCode: string): string => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = hexCode;
    return tempElement.childNodes[0].nodeValue || '';
};

// Documentation: https://dataguide.nlm.nih.gov/eutilities/utilities.html#efetch
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';

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
