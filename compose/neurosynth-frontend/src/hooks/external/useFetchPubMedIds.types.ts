export type PubMedYN = 'Y' | 'N';

export interface IPubMedArticleId {
    '#text'?: number | string;
    '@_IdType'?: 'pubmed' | 'doi' | 'pii' | 'pmc';
}

export interface IPubmedAbstractText {
    '@_Label'?: string;
    '#text'?: string;
    i?: string | string[];
}

export interface IPubmedAuthor {
    '@_CompleteYN'?: PubMedYN;
    AffiliationInfo?: {
        Affiliation?: string;
    };
    ForeName?: string;
    Initials?: string;
    LastName?: string;
}

export interface IPubmedKeyword {
    '#text'?: string;
    '@_MajorTopicYN'?: PubMedYN;
}

export interface IPubmedTitle {
    '#text'?: string;
    i: string;
}

export interface IPubMedArticle {
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

export interface IArticleListFromPubmed {
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
    PMCID: string;
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

// Documentation: https://dataguide.nlm.nih.gov/eutilities/utilities.html#efetch
export const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
export const PUBMED_API_KEY = import.meta.env.VITE_APP_PUBMED_KEY as string;
export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';
export const PUBMED_CENTRAL_ARTICLE_URL_PREFIX = 'https://ncbi.nlm.nih.gov/pmc/articles/';
export const PUBMED_MAX_IDS_PER_REQUEST = 10000;
