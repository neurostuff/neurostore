import type { ReactNode } from 'react';

type MockBaseDialogProps = {
    isOpen: boolean;
    dialogTitle: string;
    onCloseDialog: () => void;
    children?: ReactNode;
};

const MockBaseDialog: React.FC<MockBaseDialogProps> = ({ isOpen, onCloseDialog, children, dialogTitle }) =>
    isOpen ? (
        <div data-testid="mock-base-dialog">
            <span data-testid="mock-dialog-title">{dialogTitle}</span>
            <button type="button" data-testid="mock-dialog-close" onClick={onCloseDialog}>
                close-header
            </button>
            {children}
        </div>
    ) : null;

export default MockBaseDialog;
