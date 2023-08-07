export interface ICurationMetadata {
    columns: ICurationColumn[];
    prismaConfig: IPRISMAConfig;
    infoTags: ITag[];
    exclusionTags: ITag[]; // for non prisma workflows, we ignore prismaConfig and use exclusionTags. This property will not be used for the prisma workflow.
    identificationSources: ISource[];
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
    doi: string;
    articleYear: string | undefined;
    journal: string;
    abstractText: string;
    articleLink: string;
    exclusionTag: ITag | null;
    identificationSource: ISource;
    tags: ITag[];
    neurostoreId?: string;
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
