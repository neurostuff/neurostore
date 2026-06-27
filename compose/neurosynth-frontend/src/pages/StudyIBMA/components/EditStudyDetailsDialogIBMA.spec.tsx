import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetStudyNonNestedById, useUpdateStudy } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import useEnsureWritableStudy from 'pages/StudyIBMA/hooks/useEnsureWritableStudy';
import { useSnackbar } from 'notistack';
import { useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';
import EditStudyDetailsDialogIBMA from './EditStudyDetailsDialogIBMA';

vi.mock('notistack');
vi.mock('react-router-dom');
vi.mock('hooks');
vi.mock('pages/StudyIBMA/hooks/useEnsureWritableStudy');
vi.mock('components/Dialogs/BaseDialog');
vi.mock('components/EditMetadata/EditMetadata');

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

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockEnsureWritableStudy = vi.fn().mockResolvedValue({
    studyId: 'study-1',
    didClone: false,
    idMap: { oldAnalysisIdsToNewIdsMap: {}, oldImageIdToNewIdMap: {} },
});

const enqueueSnackbarMock = () => (useSnackbar() as unknown as { enqueueSnackbar: Mock }).enqueueSnackbar;

describe('EditStudyDetailsDialogIBMA', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMutateAsync.mockResolvedValue(undefined);
        mockEnsureWritableStudy.mockResolvedValue({
            studyId: 'study-1',
            didClone: false,
            idMap: { oldAnalysisIdsToNewIdsMap: {}, oldImageIdToNewIdMap: {} },
        });
        (useParams as Mock).mockReturnValue({ studyId: 'study-1', projectId: 'p1' });
        (useGetStudyNonNestedById as Mock).mockReturnValue({
            data: mockStudyData,
            isLoading: false,
            isError: false,
        });
        (useUpdateStudy as Mock).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isLoading: false,
        });
        (useEnsureWritableStudy as Mock).mockReturnValue({
            ensureWritableStudy: mockEnsureWritableStudy,
            isLoading: false,
            userOwnsStudy: true,
        });
        (useSnackbar as Mock).mockReturnValue({ enqueueSnackbar: vi.fn() });
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
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        expect(mockMutateAsync).toHaveBeenCalledWith({
            studyId: 'study-1',
            study: expect.objectContaining({
                name: 'New title',
                authors: 'Author One',
            }),
        });
        await waitFor(() =>
            expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Study saved', { variant: 'success' })
        );
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

    it('shows clone success and skips updateStudy when ensureWritableStudy clones on save', async () => {
        mockEnsureWritableStudy.mockResolvedValue({
            studyId: 'cloned-study-1',
            didClone: true,
            idMap: { oldAnalysisIdsToNewIdsMap: {}, oldImageIdToNewIdMap: {} },
        });

        render(<EditStudyDetailsDialogIBMA isOpen onClose={vi.fn()} />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Cloned title' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(mockEnsureWritableStudy).toHaveBeenCalledTimes(1));
        expect(mockEnsureWritableStudy).toHaveBeenCalledWith({
            studyRequest: expect.objectContaining({ name: 'Cloned title' }),
        });
        expect(mockMutateAsync).not.toHaveBeenCalled();
        expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Study cloned and saved', { variant: 'success' });
    });
});
