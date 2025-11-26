import { ISource, ITag } from 'hooks/projects/useGetProjects';

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string;
    pmid: string;
    pmcid: string;
    doi: string;
    articleYear: string | undefined;
    journal: string;
    abstractText: string;
    articleLink: string;
    exclusionTag: string | null;
    identificationSource: ISource;
    tags: ITag[];
    neurostoreId?: string;
    importId?: string;
}
