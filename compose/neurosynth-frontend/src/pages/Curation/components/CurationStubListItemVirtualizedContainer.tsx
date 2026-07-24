import React from 'react';
import { ICurationStubStudy } from '../Curation.types';
import CurationStubListItem from './CurationStubListItem';

const CurationStubListItemVirtualizedContainer = ({
    stub,
    selectedStubId,
    onSetSelectedStub,
    style,
}: {
    stub: ICurationStubStudy;
    selectedStubId: string | undefined;
    onSetSelectedStub: (stubId: string) => void;
    style: React.CSSProperties;
}) => {
    return (
        <CurationStubListItem
            selected={selectedStubId === stub.id}
            onSetSelectedStub={onSetSelectedStub}
            stub={stub}
            style={style}
        />
    );
};

export default CurationStubListItemVirtualizedContainer;
