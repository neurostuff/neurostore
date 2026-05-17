import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import {
    UncategorizedMapsColumn,
    type UncategorizedMapsColumnProps,
} from 'pages/StudyIBMA/components/UncategorizedMapsColumn';
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

const defaultProps: UncategorizedMapsColumnProps = {
    collapsed: false,
    onCollapsedChange: vi.fn(),
    uncategorized: [img('map-orphan')],
    selectedImageId: null,
    onToggleMapSelection: vi.fn(),
    analyses: defaultAnalyses,
    updateImage: vi.fn(),
};

const renderColumn = (overrides: Partial<UncategorizedMapsColumnProps> = {}) =>
    render(<UncategorizedMapsColumn {...defaultProps} {...overrides} />);

describe('UncategorizedMapsColumn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('expanded', () => {
        it('shows the uncategorized count in the column header', () => {
            renderColumn({
                uncategorized: [img('map-a'), img('map-b')],
            });

            expect(screen.getByTestId('uncategorized-maps-column')).toBeInTheDocument();
            expect(screen.getByText('Uncategorized maps (2)')).toBeInTheDocument();
        });

        it('lists each uncategorized map by filename', () => {
            renderColumn({
                uncategorized: [img('map-a'), img('map-b')],
            });

            expect(screen.getByText('map-a.nii')).toBeInTheDocument();
            expect(screen.getByText('map-b.nii')).toBeInTheDocument();
        });

        it('calls onCollapsedChange(true) when hide is clicked', async () => {
            const onCollapsedChange = vi.fn();
            renderColumn({ onCollapsedChange });

            await userEvent.click(screen.getByLabelText('Hide uncategorized maps'));

            expect(onCollapsedChange).toHaveBeenCalledWith(true);
        });

        it('renders a move menu item for each analysis, including Untitled when name is empty', async () => {
            renderColumn();

            await userEvent.click(screen.getByLabelText('Categorize map'));

            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', { name: 'Contrast A' })).toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: 'Contrast B' })).toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: 'Untitled' })).toBeInTheDocument();
        });

        it('shows a disabled placeholder when there are no analyses', async () => {
            renderColumn({ analyses: [] });

            await userEvent.click(screen.getByLabelText('Categorize map'));

            expect(screen.getByRole('menuitem', { name: 'No analyses yet' })).toHaveAttribute('aria-disabled', 'true');
        });

        it('calls updateImage when categorizing via move menu', async () => {
            const updateImage = vi.fn();
            renderColumn({ updateImage });

            await userEvent.click(screen.getByLabelText('Categorize map'));
            await userEvent.click(screen.getByRole('menuitem', { name: 'Contrast A' }));

            expect(updateImage).toHaveBeenCalledWith('map-orphan', 'analysis-1');
        });

        it('calls onToggleMapSelection when a map row is clicked', async () => {
            const onToggleMapSelection = vi.fn();
            renderColumn({ onToggleMapSelection });

            await userEvent.click(screen.getByText('map-orphan.nii'));

            expect(onToggleMapSelection).toHaveBeenCalledWith('map-orphan');
        });
    });

    describe('collapsed', () => {
        it('shows the collapsed panel with count in label and aria-label', () => {
            renderColumn({
                collapsed: true,
                uncategorized: [img('map-a'), img('map-b'), img('map-c')],
            });

            expect(screen.getByTestId('uncategorized-maps-collapsed')).toBeInTheDocument();
            expect(screen.queryByTestId('uncategorized-maps-column')).not.toBeInTheDocument();
            expect(screen.getByText('Uncategorized maps (3)')).toBeInTheDocument();
            expect(screen.getByLabelText('Uncategorized maps (3)')).toBeInTheDocument();
        });

        it('calls onCollapsedChange(false) when expand is clicked', async () => {
            const onCollapsedChange = vi.fn();
            renderColumn({ collapsed: true, onCollapsedChange });

            await userEvent.click(screen.getByLabelText('Uncategorized maps (1)'));

            expect(onCollapsedChange).toHaveBeenCalledWith(false);
        });
    });
});
