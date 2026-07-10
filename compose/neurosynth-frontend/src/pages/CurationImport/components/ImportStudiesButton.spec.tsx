import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ImportStudiesButton from './ImportStudiesButton';

vi.mock('pages/Curation/context/CurationBoardGroupsContext', () => ({
    useCurationBoardGroups: vi.fn().mockReturnValue({
        handleSetFirstCurationGroup: vi.fn(),
    }),
}));

vi.mock('pages/Project/store/ProjectStore', () => ({
    useProjectCurationColumns: vi.fn().mockReturnValue([]),
}));

vi.mock('components/NeurosynthPopper/NeurosynthPopper');

vi.mock('components/Dialogs/BaseDialog', () => ({
    default: vi
        .fn()
        .mockImplementation(({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
            isOpen ? <div data-testid="mock-base-dialog">{children}</div> : null
        ),
}));

// Prevent full rendering of the multi-step import form in unit tests
vi.mock('pages/CurationImport/components/Import', () => ({
    default: vi.fn().mockImplementation(() => <div data-testid="mock-import-form">Import Form</div>),
}));

describe('ImportStudiesButton', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('should render the Import Studies button', () => {
        render(<ImportStudiesButton />);
        expect(screen.getByRole('button', { name: /import studies/i })).toBeInTheDocument();
    });

    it('should show all import method options in the dropdown', () => {
        render(<ImportStudiesButton />);
        // NeurosynthPopper mock always renders its children, so menu items are visible
        expect(screen.getAllByText('Import via Pubmed ID (PMID) List').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Import via Sleuth File').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Import via Bibliography').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Manually create a new study').length).toBeGreaterThan(0);
    });

    it('should open the import dialog when an import method is selected', async () => {
        render(<ImportStudiesButton />);
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
        await user.click(screen.getByText('Import via Pubmed ID (PMID) List'));
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('mock-import-form')).toBeInTheDocument();
    });

    it('should close the import dialog when the dialog close handler is invoked', async () => {
        vi.mock('components/Dialogs/BaseDialog', () => ({
            default: vi
                .fn()
                .mockImplementation(
                    ({
                        isOpen,
                        onCloseDialog,
                        children,
                    }: {
                        isOpen: boolean;
                        onCloseDialog: () => void;
                        children: React.ReactNode;
                    }) =>
                        isOpen ? (
                            <div data-testid="mock-base-dialog">
                                {children}
                                <button data-testid="close-dialog" onClick={onCloseDialog}>
                                    close
                                </button>
                            </div>
                        ) : null
                ),
        }));

        render(<ImportStudiesButton />);
        await user.click(screen.getByText('Import via Pubmed ID (PMID) List'));
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        await user.click(screen.getByTestId('close-dialog'));
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('should not render dialog content when no import method is selected', () => {
        render(<ImportStudiesButton />);
        // Dialog is closed - no mock-import-form should be visible
        expect(screen.queryByTestId('mock-import-form')).not.toBeInTheDocument();
    });
});
