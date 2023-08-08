export interface ICurationMetadata {
    columns: ICurationColumn[];
    prismaConfig: IPRISMAConfig;
    infoTags: ITag[]; // only holds needsReview tag. In the future, this functionality may be extended
    exclusionTags: ITag[]; // for non prisma workflows, we ignore prismaConfig and use exclusionTags. This property will not be used for the prisma workflow.
    imports: (IImport & { numStudies: number })[];
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
    tags: ITag[];
    neurostoreId?: string;
    import: IImport;
}

export interface ITag {
    label: string;
    id: string;
    isExclusionTag: boolean;
    isAssignable: boolean; // whether or not this tag can be attached to a study
}

export interface IImport {
    id: string;
    name: string;
    source: ISource;
}

export interface ISource {
    label: string;
    id: string;
}
