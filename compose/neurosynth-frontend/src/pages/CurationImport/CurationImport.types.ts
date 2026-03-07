import { ICurationStubStudy } from 'pages/Curation/Curation.types';

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
