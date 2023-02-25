import { ITag } from 'hooks/requests/useGetProjects';
import React from 'react';
import CurationStubStudyDraggableContainer, {
    ICurationStubStudy,
} from '../CurationStubStudy/CurationStubStudyDraggableContainer';
import { getVisibility } from './CurationColumnDroppableContainer';
import { VariableSizeList as List } from 'react-window';

interface ICurationColumn {
    stubs: ICurationStubStudy[];
    selectedTag: ITag | undefined;
    columnIndex: number;
    handleSelectStub: (stubId: string) => void;
}

const CurationColumn: React.FC<ICurationColumn> = React.memo((props) => {
    return (
        <List>{}</List>
        // <>
        //     {props.stubs.map((stubStudy, index) => (
        //         <CurationStubStudyDraggableContainer
        //             key={stubStudy.id}
        //             columnIndex={props.columnIndex}
        //             onSelectStubStudy={props.handleSelectStub}
        //             isVisible={getVisibility(stubStudy, props.selectedTag)}
        //             index={index}
        //             {...stubStudy}
        //         />
        //     ))}
        // </>
    );
});

export default CurationColumn;
