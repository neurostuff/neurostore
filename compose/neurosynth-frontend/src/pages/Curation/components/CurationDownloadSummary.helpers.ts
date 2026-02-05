import { ICurationColumn, ICurationStubStudy } from '../Curation.types';
// @ts-expect-error @citation-js/core is throwing an error saying it cannot find types. This is because there are no npm types
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-doi';
import { toCSV } from 'helpers/downloadFile.helpers';
import { generateBibtex } from 'hooks/external/useGetBibtexCitations';
import { ITag } from 'hooks/projects/useGetProjects';

export const stubsToCSV = (curationColumns: ICurationColumn[], exclusionTags: ITag[]) => {
    const allStudies = curationColumns.reduce(
        (acc, curr) => [...acc, ...curr.stubStudies.map((stub) => ({ ...stub, status: curr.name }))],
        [] as (ICurationStubStudy & { status: string })[]
    );

    const mappedCSVStudyObjs = allStudies.map((stub) => {
        const exclusionTag = exclusionTags.find((tag) => tag.id === stub.exclusionTag);

        return {
            title: stub.title || '',
            authors: stub.authors || '',
            pmid: stub.pmid || '',
            pmcid: stub.pmcid || '',
            doi: stub.doi || '',
            articleYear: stub.articleYear || '',
            journal: stub.journal || '',
            articleLink: stub.articleLink || '',
            source: stub.identificationSource.label || '',
            status: stub.status || '',
            exclusion: exclusionTag?.label || '',
            tags: stub.tags.map((tag) => tag.label).join(', ') || '',
            neurostoreId: stub.neurostoreId || '',
        };
    });

    return toCSV(
        [
            'Title',
            'Authors',
            'PMID',
            'PMCID',
            'DOI',
            'Year',
            'Journal',
            'Link',
            'Source',
            'Status',
            'Exclusion',
            'Tags',
            'Neurostore ID',
        ],
        mappedCSVStudyObjs
    );
};

export const stubsToBibtex = (curationColumns: ICurationColumn[], exclusionTags: ITag[]) => {
    const allStudies = curationColumns.reduce(
        (acc, curr) => [
            ...acc,
            ...curr.stubStudies.map((stub) => {
                const exclusionTag = exclusionTags.find((tag) => tag.id === stub.exclusionTag);
                return {
                    ...stub,
                    status: curr.name,
                    exclusion: exclusionTag?.label || '',
                };
            }),
        ],
        [] as (ICurationStubStudy & { status: string })[]
    );
    const responses = allStudies.map((stub) => generateBibtex(stub));
    const citeObj = new Cite(responses);
    return citeObj.format('bibtex', { format: 'text' }) as string;
};
