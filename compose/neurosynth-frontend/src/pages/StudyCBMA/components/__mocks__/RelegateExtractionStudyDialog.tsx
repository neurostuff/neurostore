const MockRelegateExtractionStudyDialog = ({  isOpen, onCloseDialog  }: {
    isOpen: boolean;
    onCloseDialog: (confirm: boolean) => void;
}) => (
    <div data-testid="mock-relegate-dialog">
        {isOpen ? (
            <button type="button" data-testid="mock-relegate-confirm" onClick={() => onCloseDialog(true)}>
                confirm
            </button>
        ) : (
            <span data-testid="mock-relegate-closed">closed</span>
        )}
    </div>
);

export default MockRelegateExtractionStudyDialog;
