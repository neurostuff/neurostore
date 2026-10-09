import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationStubListItemVirtualizedContainer = ({
    stub,
    selectedStubId,
    onSetSelectedStub,
}: {
    stub: ICurationStubStudy;
    selectedStubId?: string;
    onSetSelectedStub?: (stubId: string) => void;
}) => {
    return (
        <button type="button" aria-pressed={stub.id === selectedStubId} onClick={() => onSetSelectedStub?.(stub.id)}>
            {stub.id}
        </button>
    );
};

export default CurationStubListItemVirtualizedContainer;
