const CurationStubAITableSummary = ({
    expandedState,
    onSetExpandedState,
}: {
    expandedState?: [boolean, boolean];
    onSetExpandedState?: (expandedState: [boolean, boolean]) => void;
}) => {
    return (
        <div data-testid="ai-table-summary" data-expanded-state={expandedState?.join(',')}>
            <button
                type="button"
                onClick={() => expandedState && onSetExpandedState?.([!expandedState[0], expandedState[1]])}
            >
                toggle experimental details
            </button>
        </div>
    );
};

export default CurationStubAITableSummary;
