import { ICurationStubStudy } from 'pages/Curation/Curation.types';

export enum EImportMode {
    NEUROSTORE_IMPORT = 'NEUROSTORE_IMPORT',
    PUBMED_IMPORT = 'PUBMED_IMPORT',
    MANUAL_CREATE = 'MANUAL_CREATE',
    FILE_IMPORT = 'FILE_IMPORT',
}

export type IResolveProjectDuplicatesCurationStubStudy = ICurationStubStudy & {
    columnIndex?: number;
    studyIndex?: number;
    resolution?: 'duplicate' | 'not-duplicate' | 'resolved';
    colName?: string;
};

export interface IDuplicateCase {
    importedStub: ICurationStubStudy & {
        index: number;
        resolution?: 'duplicate' | 'not-duplicate';
    };
    projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
}
