import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';

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
