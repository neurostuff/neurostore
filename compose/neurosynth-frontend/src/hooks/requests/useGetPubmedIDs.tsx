import axios from 'axios';
import { useQuery } from 'react-query';
import * as fxparser from 'fast-xml-parser';

type PubMedYN = 'Y' | 'N';

interface IArticleListFromPubmed {
    '?xml': {
        '@_version': string;
    };
    PubmedArticleSet?: {
        PubmedArticle?: {
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
                        Author?: {
                            '@_CompleteYN'?: PubMedYN;
                            AffiliationInfo?: {
                                Affiliation?: string;
                            };
                            ForeName?: string;
                            Initials?: string;
                            LastName?: string;
                        }[];
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
                    ArticleId?: {
                        '#text'?: number | string;
                        '@_IdType'?: 'pubmed' | 'doi' | 'pii' | 'pmc';
                    }[];
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
        }[];
    };
}

export interface IPubmedArticle {
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

// Documentation: https://dataguide.nlm.nih.gov/eutilities/utilities.html#efetch

const EFETCH_URL =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=';

const PUBMED_ARTICLE_URL = 'https://pubmed.ncbi.nlm.nih.gov/';

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
            select: (res) => {
                const parser = new fxparser.XMLParser({ ignoreAttributes: false });
                const parsedJSON = parser.parse(res.data) as IArticleListFromPubmed;

                if (parsedJSON?.PubmedArticleSet?.PubmedArticle) {
                    return parsedJSON.PubmedArticleSet.PubmedArticle.map((article) => {
                        const pubmedArticleRef = article?.MedlineCitation?.Article;
                        const pubmedArticleIdRef = article?.PubmedData?.ArticleIdList;

                        const authors = (pubmedArticleRef?.AuthorList?.Author || []).map(
                            (author) => ({
                                ForeName: author.ForeName || '',
                                Initials: author.Initials || '',
                                LastName: author.LastName || '',
                            })
                        );

                        const doi =
                            (pubmedArticleIdRef?.ArticleId || []).find(
                                (x) => x['@_IdType'] === 'doi'
                            )?.['#text'] || '';
                        const pmid =
                            (pubmedArticleIdRef?.ArticleId || []).find(
                                (x) => x['@_IdType'] === 'pubmed'
                            )?.['#text'] || '';

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

                        return {
                            title: pubmedArticleRef?.ArticleTitle || '',
                            authors: authors,
                            abstractText: abstract,
                            DOI: doi,
                            keywords: (article?.MedlineCitation?.KeywordList?.Keyword || [])?.map(
                                (x) => x?.['#text'] || ''
                            ),
                            PMID: article?.MedlineCitation?.PMID?.['#text'] || '',
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
                            articleLink: `${PUBMED_ARTICLE_URL}${pmid}`,
                        } as IPubmedArticle;
                    });
                }

                return [];
            },
        }
    );
};

export default useGetPubmedIDs;
