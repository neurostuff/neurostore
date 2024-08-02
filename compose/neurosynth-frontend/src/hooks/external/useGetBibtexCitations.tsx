import axios, { AxiosError } from 'axios';
import { stringToNumber } from 'helpers/utils';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useMutation } from 'react-query';

/**
 * I'll leave this file here for now because it may be useful later and I worked hard on it
 */

const stringAsAuthorArray = (authors: string): IBibtex['author'] => {
    const authorsStringToArray = authors.split(', ').map((author) => {
        const nameAsArray = author.split(' ');
        if (nameAsArray.length === 0) {
            return { given: '', family: '' };
        } else if (nameAsArray.length === 1) {
            return { given: nameAsArray[0], family: '' };
        } else {
            const givenNames = nameAsArray.slice(0, nameAsArray.length - 1).join(' ');
            return { given: givenNames, family: nameAsArray[nameAsArray.length - 1] };
        }
    });
    return authorsStringToArray;
};

const generateBibtexNote = (study: ICurationStubStudy) => {
    let bibtexNote = '';
    if (study.pmid) bibtexNote = `PMID: ${study.pmid}`;
    if (study.pmcid) bibtexNote = `${bibtexNote}; PMCID: ${study.pmcid}`;
    if (study.neurostoreId) bibtexNote = `${bibtexNote}; Neurosynth ID: ${study.neurostoreId}`;
    if (study.identificationSource.label) {
        bibtexNote = `${bibtexNote}; Source: ${study.identificationSource.label}`;
    }
    if (study.tags.length > 0) {
        const tagString = study.tags.reduce(
            (prev, curr, index, arr) =>
                `${prev}${curr.label}${index === arr.length - 1 ? '' : ','}`,
            ''
        );
        bibtexNote = `${bibtexNote}; Tags: ${tagString}`;
    }

    return bibtexNote;
};

// this is not the complete Bibtex type. There are other other types
// as described here: https://bibtex.eu/types/article/ however these are the most significant
export interface IBibtex {
    author: { given: string; family: string }[];
    title: string;
    DOI: string;
    note?: string;
    URL: string;
    abstract: string;
    issued: {
        'date-parts'?: [number, number, number][];
    };
    'container-title': string; // journal
    type: string; // article-journal for papers
}

// if we do not receive bibtex data from the api, then we create our own with the data we have
export const generateBibtex = (study: ICurationStubStudy): IBibtex => {
    const { isValid, value } = stringToNumber(study.articleYear || '');

    return {
        title: study.title,
        type: 'article-journal',
        DOI: study.doi || '',
        URL: study.articleLink || '',
        abstract: study.abstractText || '',
        note: generateBibtexNote(study),
        issued: {
            'date-parts': isValid ? [[value, 0, 0]] : undefined,
        },
        'container-title': study.journal || '',
        author: stringAsAuthorArray(study.authors || ''),
    };
};

/**
 * NOTE: this is a get request but we use useMutation so that we can query the data imperatively.
 * This means that there is no smart refetching
 * https://github.com/TanStack/query/discussions/3675
 */

const useGetBibtexCitations = () => {
    return useMutation<IBibtex, AxiosError, ICurationStubStudy, unknown>(async (study) => {
        let res: IBibtex;
        try {
            res = (
                await axios.get<{ message: IBibtex }>(
                    `https://api.crossref.org/v1/works/${study.doi}`
                )
            ).data.message;
        } catch (e) {
            res = generateBibtex(study);
        }
        // add a note with relevant neurosynth related data for provenance
        res.note = generateBibtexNote(study);
        return res;
    });
};

export default useGetBibtexCitations;
