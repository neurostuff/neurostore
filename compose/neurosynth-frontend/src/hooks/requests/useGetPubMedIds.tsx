import axios from 'axios';
import { useQuery } from 'react-query';
import * as fxparser from 'fast-xml-parser';

type PubMedYN = 'Y' | 'N';

interface IPubMedArticleId {
    '#text'?: number | string;
    '@_IdType'?: 'pubmed' | 'doi' | 'pii' | 'pmc';
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

interface IPubMedArticle {
    MedlineCitation?: {
        '@_IndexingMethod'?: string;
        '@_Owner'?: string;
        '@_Status'?: string;
        Article?: {
            '@_PubModel'?: string;
            Abstract?: {
                AbstractText?: string | { '@_Label': string; '#text': string }[];
            };
            ArticleDate?: {
                '@_DateType'?: string;
                Year?: number;
                Month?: number;
                Day?: number;
            };
            ArticleTitle?: string;
            AuthorList?: {
                '@_CompleteYN'?: PubMedYN;
                Author?: IPubmedAuthor | IPubmedAuthor[];
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
            Keyword?: {
                '#text'?: string;
                '@_MajorTopicYN'?: PubMedYN;
            }[];
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
                QualifierName: {
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
            ArticleId?: IPubMedArticleId | IPubMedArticleId[];
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
        PubmedArticle?: IPubMedArticle | IPubMedArticle[];
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
    abstractText: string | { label: string; text: string }[];
    DOI: string;
    PMID: string;
    articleYear: number | undefined;
    journal: {
        title: string;
        volume: number;
        issue: number;
        date: {
            year: number;
            month: string;
        };
    };
    articleLink: string;
}

const transformIntoArray = <T,>(arg: T): T | T[] => {
    if (!arg) return [];
    return Array.isArray(arg) ? arg : [arg];
};

// Documentation: https://dataguide.nlm.nih.gov/eutilities/utilities.html#efetch

const EFETCH_URL =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=';

export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';

const useGetPubmedIDs = (pubmedIDs: string[]) => {
    return useQuery(
        ['pubmed', pubmedIDs],
        () => {
            // adds a comma in between each id except for the last one
            const appendedIdStr = pubmedIDs.reduce(
                (prev, curr, index, arr) => `${prev}${curr}${index === arr.length - 1 ? '' : ','}`,
                ''
            );

            return axios.post(`${EFETCH_URL}${appendedIdStr}`);
        },
        {
            enabled: pubmedIDs.length > 0,
            select: (res) => {
                const parser = new fxparser.XMLParser({ ignoreAttributes: false });
                const parsedJSON = parser.parse(res.data) as IArticleListFromPubmed;

                if (parsedJSON?.PubmedArticleSet?.PubmedArticle) {
                    const articleList = transformIntoArray(
                        parsedJSON.PubmedArticleSet.PubmedArticle
                    ) as IPubMedArticle[];

                    return articleList.map((article) => {
                        const pubmedArticleRef = article?.MedlineCitation?.Article;
                        const pubmedArticleIdRef = article?.PubmedData?.ArticleIdList;

                        const authorList = transformIntoArray(
                            pubmedArticleRef?.AuthorList?.Author
                        ) as IPubmedAuthor[];
                        const authors = (authorList || []).map((author) => ({
                            ForeName: author?.ForeName || '',
                            Initials: author?.Initials || '',
                            LastName: author?.LastName || '',
                        }));

                        const articleIdList = transformIntoArray(
                            pubmedArticleIdRef?.ArticleId
                        ) as IPubMedArticleId[];
                        const doi =
                            articleIdList.find((x) => x['@_IdType'] === 'doi')?.['#text'] || '';
                        const pmid =
                            articleIdList.find((x) => x['@_IdType'] === 'pubmed')?.['#text'] || '';

                        const abstract =
                            typeof (pubmedArticleRef?.Abstract?.AbstractText || '') === 'string'
                                ? (pubmedArticleRef?.Abstract?.AbstractText as string)
                                : (
                                      pubmedArticleRef?.Abstract?.AbstractText as {
                                          '#text': string;
                                          '@_Label': string;
                                      }[]
                                  ).map((x) => ({
                                      label: x?.['@_Label'] || '',
                                      text: x?.['#text'] || '',
                                  }));

                        const year =
                            pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year ||
                            pubmedArticleRef?.ArticleDate?.Year;

                        return {
                            title: pubmedArticleRef?.ArticleTitle || '',
                            authors: authors,
                            abstractText: abstract,
                            DOI: doi,
                            keywords: (article?.MedlineCitation?.KeywordList?.Keyword || [])?.map(
                                (x) => x?.['#text'] || ''
                            ),
                            PMID: article?.MedlineCitation?.PMID?.['#text'] || '',
                            articleYear: year,
                            journal: {
                                title: pubmedArticleRef?.Journal?.Title || '',
                                volume: pubmedArticleRef?.Journal?.JournalIssue?.Volume || 0,
                                issue: pubmedArticleRef?.Journal?.JournalIssue?.Issue || 0,
                                date: {
                                    year:
                                        pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year || 0,
                                    month:
                                        pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Month ||
                                        '',
                                },
                            },
                            articleLink: `${PUBMED_ARTICLE_URL_PREFIX}${pmid}`,
                        } as INeurosynthParsedPubmedArticle;
                    });
                }

                return [];
            },
        }
    );
};

export default useGetPubmedIDs;
