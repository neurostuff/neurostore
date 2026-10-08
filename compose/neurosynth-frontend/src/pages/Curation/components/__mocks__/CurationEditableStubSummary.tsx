import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import React from 'react';

const CurationEditableStubSummary = ({
    stub,
    columnIndex,
    onMoveToNextStub,
    isAbstractExpanded,
    children,
}: {
    stub?: ICurationStubStudy;
    columnIndex?: number;
    onMoveToNextStub?: () => void;
    isAbstractExpanded?: boolean;
    children?: React.ReactNode;
}) => {
    return (
        <div
            data-testid="stub-summary"
            data-stub-id={stub?.id}
            data-column-index={columnIndex}
            data-abstract-expanded={String(isAbstractExpanded)}
        >
            <button type="button" onClick={onMoveToNextStub}>
                move to next stub
            </button>
            {children}
        </div>
    );
};

export default CurationEditableStubSummary;
