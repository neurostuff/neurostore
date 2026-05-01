import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EditStudyDetailsDialogIBMA from './EditStudyDetailsDialogIBMA';

const updateStudyDetails = vi.fn();
const addOrUpdateMetadata = vi.fn();
const deleteMetadataRow = vi.fn();

vi.mock('components/Dialogs/BaseDialog', () => ({
    default: vi.fn(
        ({
            isOpen,
            onCloseDialog,
            children,
            dialogTitle,
        }: {
            isOpen: boolean;
            onCloseDialog: () => void;
            children: React.ReactNode;
            dialogTitle: string;
        }) =>
            isOpen ? (
                <div data-testid="mock-base-dialog">
                    <span data-testid="mock-dialog-title">{dialogTitle}</span>
                    <button type="button" data-testid="mock-dialog-x" onClick={onCloseDialog}>
                        close-header
                    </button>
                    {children}
                </div>
            ) : null
    ),
}));

vi.mock('components/EditMetadata/EditMetadata', () => ({
    default: (props: {
        onMetadataRowEdit: (row: { metadataKey: string; metadataValue: string }) => void;
        metadata: { metadataKey: string }[];
    }) => (
        <div data-testid="mock-edit-metadata">
            <span data-testid="mock-metadata-count">{props.metadata.length}</span>
            <button
                type="button"
                data-testid="mock-metadata-edit"
                onClick={() => props.onMetadataRowEdit({ metadataKey: 'sample_size', metadataValue: '42' })}
            >
                simulate-metadata-edit
            </button>
        </div>
    ),
}));

vi.mock('stores/study/StudyStore', () => ({
    useStudyName: vi.fn(() => 'Study A'),
    useStudyDescription: vi.fn(() => 'Desc'),
    useStudyAuthors: vi.fn(() => 'Author One'),
    useStudyPublication: vi.fn(() => 'Journal'),
    useStudyDOI: vi.fn(() => '10.1/x'),
    useStudyPMID: vi.fn(() => '123'),
    useStudyPMCID: vi.fn(() => 'PMC1'),
    useStudyYear: vi.fn(() => 2020),
    useUpdateStudyDetails: vi.fn(() => updateStudyDetails),
    useStudyMetadata: vi.fn(() => [{ metadataKey: 'sample_size', metadataValue: null }]),
    useAddOrUpdateMetadata: vi.fn(() => addOrUpdateMetadata),
    useDeleteMetadataRow: vi.fn(() => deleteMetadataRow),
}));

describe('EditStudyDetailsDialogIBMA', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when closed', () => {
        render(<EditStudyDetailsDialogIBMA isOpen={false} onClose={vi.fn()} />);
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog content and study fields when open', () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Edit study details');
        expect(screen.getByTestId('edit-study-ibma-details-dialog')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Study A');
        expect(screen.getByRole('textbox', { name: 'Authors' })).toHaveValue('Author One');
        expect(screen.getByRole('textbox', { name: 'Journal' })).toHaveValue('Journal');
        expect(screen.getByRole('textbox', { name: 'DOI' })).toHaveValue('10.1/x');
        expect(screen.getByRole('textbox', { name: 'PMID' })).toHaveValue('123');
        expect(screen.getByRole('textbox', { name: 'PMCID' })).toHaveValue('PMC1');
        expect(screen.getByRole('spinbutton', { name: 'Year' })).toHaveValue(2020);
        expect(screen.getByRole('textbox', { name: 'Description or abstract' })).toHaveValue('Desc');
    });

    it('calls updateStudyDetails when title changes', () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        const title = screen.getByRole('textbox', { name: 'Title' });
        fireEvent.change(title, { target: { value: 'New title' } });
        expect(updateStudyDetails).toHaveBeenCalledWith('name', 'New title');
    });

    it('calls onClose when Close is clicked', async () => {
        const onClose = vi.fn();
        render(<EditStudyDetailsDialogIBMA isOpen onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('passes metadata to EditMetadata and wires addOrUpdateMetadata on row edit', async () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        expect(screen.getByTestId('mock-metadata-count')).toHaveTextContent('1');
        await userEvent.click(screen.getByTestId('mock-metadata-edit'));
        expect(addOrUpdateMetadata).toHaveBeenCalledWith({ metadataKey: 'sample_size', metadataValue: '42' });
    });
});
