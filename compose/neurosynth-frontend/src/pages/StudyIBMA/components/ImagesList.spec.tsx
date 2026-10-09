import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import ImagesList, { type ImagesListProps } from 'pages/StudyIBMA/components/ImagesList';
import { vi } from 'vitest';

const img = (id: string, filename?: string): ImageReturn => ({
    id,
    filename: filename ?? `${id}.nii`,
    public: true,
    created_at: '',
    updated_at: null,
    user: null,
    username: null,
    metadata: null,
    space: null,
    add_date: null,
    url: null,
    value_type: 'T',
    entities: undefined,
    analysis_name: null,
});

const defaultProps: ImagesListProps = {
    images: [img('image-a')],
    selectedImageId: null,
    loadingImageId: undefined,
    onSelectImage: vi.fn(),
    onMoveClick: vi.fn(),
    onRemoveFromAnalysis: vi.fn(),
};

const renderList = (overrides: Partial<ImagesListProps> = {}) =>
    render(<ImagesList {...defaultProps} {...overrides} />);

describe('ImagesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists each image by filename', () => {
        renderList({
            images: [img('image-a'), img('image-b')],
        });

        expect(screen.getByText('image-a.nii')).toBeInTheDocument();
        expect(screen.getByText('image-b.nii')).toBeInTheDocument();
    });

    it('calls onSelectImage when a row is clicked', async () => {
        const onSelectImage = vi.fn();
        renderList({ onSelectImage });

        await userEvent.click(screen.getByText('image-a.nii'));

        expect(onSelectImage).toHaveBeenCalledWith('image-a');
    });

    it('calls onMoveClick when the move control is clicked', async () => {
        const onMoveClick = vi.fn();
        renderList({ onMoveClick });

        await userEvent.click(screen.getByLabelText('Move image to analysis'));

        expect(onMoveClick).toHaveBeenCalledTimes(1);
        expect(onMoveClick.mock.calls[0][1]).toBe('image-a');
    });

    it('calls onRemoveFromAnalysis when remove is clicked', async () => {
        const onRemoveFromAnalysis = vi.fn();
        renderList({ onRemoveFromAnalysis });

        await userEvent.click(screen.getByLabelText('Remove from analysis'));

        expect(onRemoveFromAnalysis).toHaveBeenCalledWith('image-a');
    });

    it('does not render remove control when onRemoveFromAnalysis is omitted', () => {
        renderList({ onRemoveFromAnalysis: undefined });

        expect(screen.queryByLabelText('Remove from analysis')).not.toBeInTheDocument();
    });

    it('shows a progress indicator on the move control while that image is updating', () => {
        renderList({
            updateImageIsLoading: true,
            loadingImageId: 'image-a',
        });

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByLabelText('Move image to analysis')).not.toBeInTheDocument();
    });

    it('shows a progress indicator on the remove control while that image is removing', () => {
        renderList({
            removeImageIsLoading: true,
            loadingImageId: 'image-a',
        });

        const removeControl = screen.getByLabelText('Remove from analysis');
        expect(removeControl).toBeInTheDocument();
        expect(within(removeControl).getByRole('progressbar')).toBeInTheDocument();
    });
});
