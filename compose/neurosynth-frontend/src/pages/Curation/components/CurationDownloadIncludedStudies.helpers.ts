import { ICurationStubStudy } from '../Curation.types';
// @ts-expect-error @citation-js/core is throwing an error saying it cannot find types. This is because there are no npm types
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-doi';
import { generateBibtex } from 'hooks/external/useGetBibtexCitations';

export const stubsToCSV = (stubs: ICurationStubStudy[]) => {
    const mappedCSVStudyObjs = stubs.map((stub) => ({
        title: stub.title || '',
        authors: stub.authors || '',
        pmid: stub.pmid || '',
        pmcid: stub.pmcid || '',
        doi: stub.doi || '',
        articleYear: stub.articleYear || '',
        journal: stub.journal || '',
        articleLink: stub.articleLink || '',
        source: stub.identificationSource.label || '',
        tags: stub.tags.reduce(
            (prev, curr, index, arr) => `${prev}${curr.label}${index === arr.length - 1 ? '' : ','}`,
            ''
        ),
        neurostoreId: stub.neurostoreId || '',
        searchTerm: stub.searchTerm || '',
    }));

    return [
        {
            title: 'Title',
            authors: 'Authors',
            pmid: 'PMID',
            pmcid: 'PMCID',
            doi: 'DOI',
            articleYear: 'Year',
            journal: 'Journal',
            articleLink: 'Link',
            source: 'Source',
            tags: 'Tags',
            neurostoreId: 'Neurosynth ID',
            searchTerm: 'Search Term',
        },
        ...mappedCSVStudyObjs,
    ]
        .map((study) => {
            const studyValues = Object.values(study); // order is respected
            return studyValues
                .map(String)
                .map((value) => value.replaceAll('"', '""'))
                .map((value) => `"${value}"`)
                .join(',');
        })
        .join('\r\n');
};

export const stubsToBibtex = (stubs: ICurationStubStudy[]) => {
    const responses = stubs.map((stub) => generateBibtex(stub));
    const citeObj = new Cite(responses);
    return citeObj.format('bibtex', { format: 'text' }) as string;
};
