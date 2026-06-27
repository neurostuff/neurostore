import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import SearchableAnalysisMenu, {
    filterAnalysesBySearchQuery,
    getAnalysisDisplayName,
} from 'pages/StudyIBMA/components/SearchableAnalysisMenu';
import { vi } from 'vitest';

const analyses: AnalysisReturnNested[] = [
    { id: 'analysis-1', name: 'Motor contrast', images: [] },
    { id: 'analysis-2', name: 'Visual contrast', images: [] },
    { id: 'analysis-3', name: '  ', images: [] },
];

describe('getAnalysisDisplayName', () => {
    it('returns Untitled when name is empty or whitespace', () => {
        expect(getAnalysisDisplayName({ name: '' })).toBe('Untitled');
        expect(getAnalysisDisplayName({ name: '   ' })).toBe('Untitled');
    });

    it('returns trimmed name when present', () => {
        expect(getAnalysisDisplayName({ name: '  Motor  ' })).toBe('Motor');
    });
});

describe('filterAnalysesBySearchQuery', () => {
    it('returns all analyses when query is empty', () => {
        expect(filterAnalysesBySearchQuery(analyses, '')).toHaveLength(3);
        expect(filterAnalysesBySearchQuery(analyses, '   ')).toHaveLength(3);
    });

    it('filters by display name case-insensitively', () => {
        const filtered = filterAnalysesBySearchQuery(analyses, 'visual');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('analysis-2');
    });

    it('matches Untitled analyses when searching for untitled', () => {
        const filtered = filterAnalysesBySearchQuery(analyses, 'untitled');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('analysis-3');
    });
});

describe('SearchableAnalysisMenu', () => {
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);

    const renderMenu = (overrides: Partial<Parameters<typeof SearchableAnalysisMenu>[0]> = {}) =>
        render(
            <SearchableAnalysisMenu
                open
                anchorEl={anchorEl}
                onClose={vi.fn()}
                analyses={analyses}
                onSelectAnalysis={vi.fn()}
                {...overrides}
            />
        );

    it('renders a search field and all analysis menu items when open', () => {
        renderMenu();

        expect(screen.getByTestId('analysis-move-menu-search')).toBeInTheDocument();
        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Motor contrast' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Visual contrast' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Untitled' })).toBeInTheDocument();
    });

    it('filters menu items as the user types in the search field', async () => {
        renderMenu();

        await userEvent.type(screen.getByTestId('analysis-move-menu-search'), 'motor');

        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Motor contrast' })).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Visual contrast' })).not.toBeInTheDocument();
    });

    it('shows a disabled placeholder when no analyses match the search', async () => {
        renderMenu();

        await userEvent.type(screen.getByTestId('analysis-move-menu-search'), 'nonexistent');

        expect(screen.getByRole('menuitem', { name: 'No matching analyses' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows a disabled placeholder when there are no analyses', () => {
        renderMenu({ analyses: [] });

        expect(screen.getByRole('menuitem', { name: 'No analyses yet' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('calls onSelectAnalysis when a menu item is chosen', async () => {
        const onSelectAnalysis = vi.fn();
        renderMenu({ onSelectAnalysis });

        await userEvent.click(screen.getByRole('menuitem', { name: 'Visual contrast' }));

        expect(onSelectAnalysis).toHaveBeenCalledWith('analysis-2');
    });

    it('labels the current analysis and does not call onSelectAnalysis when it is chosen', async () => {
        const onSelectAnalysis = vi.fn();
        const onClose = vi.fn();
        renderMenu({ currentAnalysisId: 'analysis-1', onSelectAnalysis, onClose });

        expect(screen.getByRole('menuitem', { name: 'Motor contrast (current analysis)' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('menuitem', { name: 'Motor contrast (current analysis)' }));

        expect(onSelectAnalysis).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
