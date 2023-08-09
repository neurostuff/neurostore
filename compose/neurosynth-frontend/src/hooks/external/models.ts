export interface ISemanticScholarResponse {
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
