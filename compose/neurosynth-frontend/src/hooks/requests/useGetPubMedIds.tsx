import axios from 'axios';
import { useQuery } from 'react-query';
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
                AbstractText?: string | IPubmedAbstractText | IPubmedAbstractText[];
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
            Keyword?: string | IPubmedKeyword | IPubmedKeyword[];
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

const transformIntoArrayHelper = <T,>(arg: T): T | T[] => {
    if (!arg) return [];
    return Array.isArray(arg) ? arg : [arg];
};

const extractAuthorsHelper = (
    authors: IPubmedAuthor | IPubmedAuthor[] | undefined
): IPubmedAuthor[] => {
    const authorList = (transformIntoArrayHelper(authors) as IPubmedAuthor[]) || [];
    return authorList.map((author) => ({
        ForeName: author?.ForeName || '',
        Initials: author?.Initials || '',
        LastName: author?.LastName || '',
    }));
};

const extractDOIHelper = (
    articleIds: IPubMedArticleId | IPubMedArticleId[] | undefined
): string => {
    const articleIdList = (transformIntoArrayHelper(articleIds) as IPubMedArticleId[]) || [];

    const doiArticleId = articleIdList.find(
        (article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'doi'
    );
    const extractedDOI = doiArticleId?.['#text'];
    if (!doiArticleId || !extractedDOI) return '';

    return typeof extractedDOI === 'number' ? extractedDOI.toString() : extractedDOI;
};

const extractPMIDHelper = (
    medlineCitationPmid: string | undefined | number,
    articleIds: IPubMedArticleId | IPubMedArticleId[] | undefined
): string => {
    if (medlineCitationPmid) return medlineCitationPmid.toString();

    const articleIdList = (transformIntoArrayHelper(articleIds) as IPubMedArticleId[]) || [];

    const pmidArticleId = articleIdList.find(
        (article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'pubmed'
    );
    const extractedPMID = pmidArticleId?.['#text'];
    if (!pmidArticleId || !extractedPMID) return '';

    return typeof extractedPMID === 'number' ? extractedPMID.toString() : extractedPMID;
};

const extractAbstractHelper = (
    abstractTextSections: string | IPubmedAbstractText | IPubmedAbstractText[] | undefined
): string => {
    if (typeof abstractTextSections === 'string') {
        return abstractTextSections;
    } else if (typeof abstractTextSections === 'object') {
        const abstractSectionArr = transformIntoArrayHelper(abstractTextSections) as {
            '@_Label': string;
            '#text': string;
        }[];

        return abstractSectionArr.reduce(
            (acc, curr) => `${acc}${curr['@_Label'] || ''}\n${curr['#text'] || ''}\n`,
            ''
        );
    } else {
        return '';
    }
};

const extractKeywordsHelper = (
    keywords: string | IPubmedKeyword | IPubmedKeyword[] | undefined
): string[] => {
    if (typeof keywords === 'string') {
        return [keywords];
    } else if (typeof keywords === 'object') {
        const keywordsList = transformIntoArrayHelper(keywords) as IPubmedKeyword[];
        return keywordsList.map((x) => x?.['#text'] || '');
    } else {
        return [];
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

const EFETCH_URL =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=';

export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';
const parser = new XMLParser({
    ignoreAttributes: false,
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
    // TODO: implement isArray so I can get rid of the transformIntoArrayHelper
    // isArray(tagName, jPath, isLeafNode, isAttribute) {
    //     return true;
    // },
});

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
                const parsedJSON = parser.parse(res.data) as IArticleListFromPubmed;

                if (parsedJSON?.PubmedArticleSet?.PubmedArticle) {
                    const articleList = transformIntoArrayHelper(
                        parsedJSON.PubmedArticleSet.PubmedArticle
                    ) as IPubMedArticle[];

                    const x = articleList.map((article) => {
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
                                        pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Month ||
                                        '',
                                },
                            },
                            articleLink: `${PUBMED_ARTICLE_URL_PREFIX}${pmid}`,
                        } as INeurosynthParsedPubmedArticle;
                    });
                    return x;
                }

                return [];
            },
        }
    );
};

export default useGetPubmedIDs;
