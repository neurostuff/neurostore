import {
    IPubmedAuthor,
    IPubMedArticleId,
    IPubmedAbstractText,
    IPubmedKeyword,
    IPubmedTitle,
} from 'hooks/external/models';

export const extractAuthorsHelper = (authors: IPubmedAuthor[] | undefined): IPubmedAuthor[] => {
    const authorList = authors || [];
    return authorList.map((author) => ({
        ForeName: author?.ForeName || '',
        Initials: author?.Initials || '',
        LastName: author?.LastName || '',
    }));
};

export const extractDOIHelper = (articleIds: IPubMedArticleId[] | undefined): string => {
    const articleIdList = articleIds || [];

    const doiArticleId = articleIdList.find(
        (article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'doi'
    );
    const extractedDOI = doiArticleId?.['#text'];
    if (!doiArticleId || !extractedDOI) return '';

    return typeof extractedDOI === 'number' ? extractedDOI.toString() : extractedDOI;
};

export const extractPMIDHelper = (
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

export const extractAbstractHelper = (
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

export const extractKeywordsHelper = (
    keywords: string[] | IPubmedKeyword[] | undefined
): string[] => {
    if (!keywords || keywords.length === 0) return [];

    if (typeof keywords[0] === 'string') {
        return keywords as string[];
    } else {
        return (keywords as IPubmedKeyword[]).map((x) => x?.['#text'] || '') as string[];
    }
};

export const extractTitleHelper = (title: string | IPubmedTitle | undefined): string => {
    if (typeof title === 'string') {
        return title;
    } else if (typeof title === 'object') {
        return title['#text'] || '';
    } else {
        return '';
    }
};

// we take advantage of the HTML Entities already encoded to convert: https://www.w3.org/TR/html4/sgml/entities.html
export const hexCodeToHTMLEntity = (hexCode: string): string => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = hexCode;
    return tempElement.childNodes[0].nodeValue || '';
};

// Documentation: https://dataguide.nlm.nih.gov/eutilities/utilities.html#efetch
export const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';
