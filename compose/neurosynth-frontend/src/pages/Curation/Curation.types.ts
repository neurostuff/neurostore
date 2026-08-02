export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

export interface ITag {
    label: string;
    id: string;
    isExclusionTag: boolean;
    isAssignable: boolean; // whether or not this tag can be attached to a study
}

export interface ISource {
    label: string;
    id: string;
}

export interface IPRISMAConfig {
    isPrisma: boolean;
    identification: {
        exclusionTags: ITag[];
    };
    screening: {
        exclusionTags: ITag[];
    };
    eligibility: {
        exclusionTags: ITag[];
    };
}

export enum EImportMode {
    NEUROSTORE_IMPORT = 'NEUROSTORE_IMPORT',
    PUBMED_IMPORT = 'PUBMED_IMPORT',
    FILE_IMPORT = 'FILE_IMPORT',
    SLEUTH_IMPORT = 'SLEUTH_IMPORT',
    MANUAL_CREATE = 'MANUAL_CREATE',
}

export interface IImport {
    id: string;
    name: string;
    date: string; // ISO DateTime
    importModeUsed: EImportMode;
    errorsDuringImport?: string;
    numImported: number;
    neurostoreSearchParams?: string; // search params used for studies (if neurostore was used for import)
    fileName?: string; // file name imported (if imported via bibtex or pubmed file)
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

export interface ICurationMetadata {
    columns: ICurationColumn[];
    prismaConfig: IPRISMAConfig;
    infoTags: ITag[];
    exclusionTags: ITag[]; // for non prisma workflows, we ignore prismaConfig and use exclusionTags. This property will not be used for the prisma workflow.
    identificationSources: ISource[];
    imports: IImport[];
}
