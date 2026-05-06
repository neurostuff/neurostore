import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { vi } from 'vitest';
import EditStudyDetailsDialogIBMA from './EditStudyDetailsDialogIBMA';

const mockStudyData: StudyReturn = {
    id: 'study-1',
    name: 'Study A',
    description: 'Desc',
    authors: 'Author One',
    publication: 'Journal',
    doi: '10.1/x',
    pmid: '123',
    pmcid: 'PMC1',
    year: 2020,
    metadata: null,
    analyses: [],
};

const { mockMutateAsync, mockEnqueueSnackbar } = vi.hoisted(() => ({
    mockMutateAsync: vi.fn().mockResolvedValue(undefined),
    mockEnqueueSnackbar: vi.fn(),
}));

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const mod = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...mod,
        useNavigate: () => vi.fn(),
        useParams: () => ({ studyId: 'study-1', projectId: 'p1' }),
    };
});

vi.mock('hooks', async (importOriginal) => {
    const mod = await importOriginal<typeof import('hooks')>();
    return {
        ...mod,
        useCreateStudy: vi.fn(() => ({
            mutateAsync: vi.fn().mockResolvedValue({ data: mockStudyData }),
            isLoading: false,
        })),
        useGetAnnotationById: vi.fn(() => ({
            data: { notes: [] },
            isLoading: false,
            isError: false,
        })),
        useGetStudyNonNestedById: vi.fn(() => ({
            data: mockStudyData,
            isLoading: false,
            isError: false,
        })),
        useGetStudysetNonNestedById: vi.fn(() => ({
            data: { studies: ['study-1'], studyset_studies: [] },
            isLoading: false,
            isError: false,
        })),
        useUpdateAnnotationByAnnotationAndAnalysisIds: vi.fn(() => ({
            mutateAsync: vi.fn().mockResolvedValue(undefined),
            isLoading: false,
        })),
        useUpdateStudy: vi.fn(() => ({
            mutateAsync: mockMutateAsync,
            isLoading: false,
        })),
        useUpdateStudyset: vi.fn(() => ({
            mutateAsync: vi.fn().mockResolvedValue(undefined),
            isLoading: false,
        })),
        useUserCanEdit: vi.fn(() => true),
    };
});

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

    it('persists study when Save is clicked after title change', async () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        const title = screen.getByRole('textbox', { name: 'Title' });
        fireEvent.change(title, { target: { value: 'New title' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);
        expect(mockMutateAsync).toHaveBeenCalledWith({
            studyId: 'study-1',
            study: expect.objectContaining({
                name: 'New title',
                authors: 'Author One',
                analyses: [],
            }),
        });
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Study saved', { variant: 'success' });
    });

    it('calls onClose when Close is clicked without persisting', async () => {
        const onClose = vi.fn();
        render(<EditStudyDetailsDialogIBMA isOpen onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('does not persist when Close is clicked after edits', async () => {
        const onClose = vi.fn();
        render(<EditStudyDetailsDialogIBMA isOpen onClose={onClose} />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Draft title' } });
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockMutateAsync).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('persists study when Save is clicked with no edits', async () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        // Save is disabled until the form is touched; nudge description away and back so payload matches the loaded study.
        const description = screen.getByRole('textbox', { name: 'Description or abstract' });
        fireEvent.change(description, { target: { value: `${mockStudyData.description} ` } });
        fireEvent.change(description, { target: { value: mockStudyData.description ?? '' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);
        expect(mockMutateAsync).toHaveBeenCalledWith({
            studyId: 'study-1',
            study: expect.objectContaining({
                name: 'Study A',
                analyses: [],
            }),
        });
    });

    it('passes metadata to EditMetadata and persists metadata on Save after row edit', async () => {
        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        expect(screen.getByTestId('mock-metadata-count')).toHaveTextContent('1');
        await userEvent.click(screen.getByTestId('mock-metadata-edit'));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);
        const payload = mockMutateAsync.mock.calls[0][0].study.metadata as Record<string, unknown>;
        expect(payload.sample_size).toBe('42');
    });
});
