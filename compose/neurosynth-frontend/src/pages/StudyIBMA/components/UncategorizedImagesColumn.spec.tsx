import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import UncategorizedImagesColumn, {
    type UncategorizedImagesColumnProps,
} from 'pages/StudyIBMA/components/UncategorizedImagesColumn';
import { vi } from 'vitest';

const img = (id: string, analysis?: string): ImageReturn => ({
    id,
    filename: `${id}.nii`,
    analysis,
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

const defaultAnalyses: AnalysisReturnNested[] = [
    { id: 'analysis-1', name: 'Contrast A', images: [] },
    { id: 'analysis-2', name: 'Contrast B', images: [] },
    { id: 'analysis-3', name: '', images: [] },
];

const defaultProps: UncategorizedImagesColumnProps = {
    collapsed: false,
    onCollapsedChange: vi.fn(),
    uncategorized: [img('orphan-image')],
    selectedImageId: null,
    onToggleImageSelection: vi.fn(),
    analyses: defaultAnalyses,
    updateImage: vi.fn(),
};

const renderColumn = (overrides: Partial<UncategorizedImagesColumnProps> = {}) =>
    render(<UncategorizedImagesColumn {...defaultProps} {...overrides} />);

describe('UncategorizedImagesColumn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('expanded', () => {
        it('shows the uncategorized count in the column header', () => {
            renderColumn({
                uncategorized: [img('image-a'), img('image-b')],
            });

            expect(screen.getByTestId('uncategorized-images-column')).toBeInTheDocument();
            expect(screen.getByText('Uncategorized images (2)')).toBeInTheDocument();
        });

        it('lists each uncategorized image by filename', () => {
            renderColumn({
                uncategorized: [img('image-a'), img('image-b')],
            });

            expect(screen.getByText('image-a.nii')).toBeInTheDocument();
            expect(screen.getByText('image-b.nii')).toBeInTheDocument();
        });

        it('calls onCollapsedChange(true) when hide is clicked', async () => {
            const onCollapsedChange = vi.fn();
            renderColumn({ onCollapsedChange });

            await userEvent.click(screen.getByLabelText('Hide uncategorized images'));

            expect(onCollapsedChange).toHaveBeenCalledWith(true);
        });

        it('renders a searchable move menu with each analysis, including Untitled when name is empty', async () => {
            renderColumn();

            await userEvent.click(screen.getByLabelText('Move image to analysis'));

            expect(screen.getByTestId('analysis-move-menu-search')).toBeInTheDocument();
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', { name: 'Contrast A' })).toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: 'Contrast B' })).toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: 'Untitled' })).toBeInTheDocument();
        });

        it('filters move menu analyses when searching', async () => {
            renderColumn();

            await userEvent.click(screen.getByLabelText('Move image to analysis'));
            await userEvent.type(screen.getByTestId('analysis-move-menu-search'), 'contrast b');

            const menu = screen.getByRole('menu');
            expect(within(menu).queryByRole('menuitem', { name: 'Contrast A' })).not.toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: 'Contrast B' })).toBeInTheDocument();
        });

        it('shows a disabled placeholder when there are no analyses', async () => {
            renderColumn({ analyses: [] });

            await userEvent.click(screen.getByLabelText('Move image to analysis'));

            expect(screen.getByRole('menuitem', { name: 'No analyses yet' })).toHaveAttribute('aria-disabled', 'true');
        });

        it('calls updateImage when assigning via move menu', async () => {
            const updateImage = vi.fn();
            renderColumn({ updateImage });

            await userEvent.click(screen.getByLabelText('Move image to analysis'));
            await userEvent.click(screen.getByRole('menuitem', { name: 'Contrast A' }));

            expect(updateImage).toHaveBeenCalledWith('orphan-image', { analysis: 'analysis-1' });
        });

        it('calls onToggleImageSelection when an image row is clicked', async () => {
            const onToggleImageSelection = vi.fn();
            renderColumn({ onToggleImageSelection });

            await userEvent.click(screen.getByText('orphan-image.nii'));

            expect(onToggleImageSelection).toHaveBeenCalledWith('orphan-image');
        });
    });

    describe('collapsed', () => {
        it('shows the collapsed panel with count in label and aria-label', () => {
            renderColumn({
                collapsed: true,
                uncategorized: [img('image-a'), img('image-b'), img('image-c')],
            });

            expect(screen.getByTestId('uncategorized-images-collapsed')).toBeInTheDocument();
            expect(screen.queryByTestId('uncategorized-images-column')).not.toBeInTheDocument();
            expect(screen.getByText('Uncategorized images (3)')).toBeInTheDocument();
            expect(screen.getByLabelText('Uncategorized images (3)')).toBeInTheDocument();
        });

        it('calls onCollapsedChange(false) when expand is clicked', async () => {
            const onCollapsedChange = vi.fn();
            renderColumn({ collapsed: true, onCollapsedChange });

            await userEvent.click(screen.getByLabelText('Uncategorized images (1)'));

            expect(onCollapsedChange).toHaveBeenCalledWith(false);
        });
    });
});
