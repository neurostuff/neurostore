import { XMLParser } from 'fast-xml-parser';
import {
    INeurosynthParsedPubmedArticle,
    IPubMedArticle,
    IPubMedArticleId,
    IPubmedAbstractText,
    IPubmedAuthor,
    IPubmedKeyword,
    IPubmedTitle,
    PUBMED_ARTICLE_URL_PREFIX,
} from './useFetchPubMedIds.types';

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

    const doiArticleId = articleIdList.find((article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'doi');
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

    const pmidArticleId = articleIdList.find((article) => (article['@_IdType'] || '').toLocaleLowerCase() === 'pubmed');
    const extractedPMID = pmidArticleId?.['#text'];
    if (!pmidArticleId || !extractedPMID) return '';

    return typeof extractedPMID === 'number' ? extractedPMID.toString() : extractedPMID;
};

const extractPMCIDHelper = (articleIds: IPubMedArticleId[] | undefined): string => {
    if (!articleIds || articleIds.length === 0) return '';
    const pmcArticleId = articleIds.find((articleId) => articleId['@_IdType']?.toLocaleLowerCase() === 'pmc');
    if (!pmcArticleId?.['#text']) return '';
    // this is safe to cast as string because all PMC IDs are of the format: "PMCXXXXXXX"
    return pmcArticleId['#text'] as string;
};

const extractAbstractHelper = (abstractTextSections: string[] | IPubmedAbstractText[] | undefined): string => {
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

export const parseXMLPubmedArticle = (article: IPubMedArticle) => {
    const pubmedArticleRef = article?.MedlineCitation?.Article;
    const pubmedArticleIdRef = article?.PubmedData?.ArticleIdList;

    const title = extractTitleHelper(pubmedArticleRef?.ArticleTitle);
    const authors = extractAuthorsHelper(pubmedArticleRef?.AuthorList?.Author);
    const doi = extractDOIHelper(pubmedArticleIdRef?.ArticleId);
    const pmid = extractPMIDHelper(article?.MedlineCitation?.PMID?.['#text'], pubmedArticleIdRef?.ArticleId);
    const pmicid = extractPMCIDHelper(pubmedArticleIdRef?.ArticleId);
    const abstract = extractAbstractHelper(pubmedArticleRef?.Abstract?.AbstractText);
    const year = (
        pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year ||
        pubmedArticleRef?.ArticleDate?.Year ||
        0
    )?.toString();
    const keywords = extractKeywordsHelper(article?.MedlineCitation?.KeywordList?.Keyword);

    return {
        title: title,
        authors: authors,
        abstractText: abstract,
        DOI: doi,
        keywords: keywords,
        PMID: pmid,
        PMCID: pmicid,
        articleYear: year,
        journal: {
            title: pubmedArticleRef?.Journal?.Title || '',
            volume: pubmedArticleRef?.Journal?.JournalIssue?.Volume || 0,
            issue: pubmedArticleRef?.Journal?.JournalIssue?.Issue || 0,
            date: {
                year: (pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Year || 0).toString(),
                month: pubmedArticleRef?.Journal?.JournalIssue?.PubDate?.Month || '',
            },
        },
        articleLink: `${PUBMED_ARTICLE_URL_PREFIX}${pmid}`,
    } as INeurosynthParsedPubmedArticle;
};

export const parser = new XMLParser({
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
    isArray(tagName, jPath) {
        return [
            `PubmedArticleSet.PubmedArticle.MedlineCitation.Article.AuthorList.Author`,
            `PubmedArticleSet.PubmedArticle`,
            `PubmedArticleSet.PubmedArticle.PubmedData.ArticleIdList.ArticleId`,
            `PubmedArticleSet.PubmedArticle.MedlineCitation.Article.Abstract.AbstractText`,
            `PubmedArticleSet.PubmedArticle.MedlineCitation.KeywordList.Keyword`,
        ].includes(jPath);
    },
});
