import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { MockThemeProvider } from 'testing/helpers';
import { OnvocTreeNode } from 'pages/Explore/Explore.mockData';
import ExplorePage from './ExplorePage';

vi.mock('../../../seo/hooks', () => ({
    usePageMetadata: () => undefined,
}));

vi.mock('pages/Explore/components/OnvocTreeFilter', () => ({
    default: ({ title, nodes }: { title: string; nodes: OnvocTreeNode[] }) => (
        <section>
            <h2>{title}</h2>
            <span data-testid={`onvoc-first-child-${title}`}>{nodes[0]?.label ?? ''}</span>
            <span data-testid={`onvoc-node-count-${title}`}>{nodes.length}</span>
        </section>
    ),
}));

const renderExplorePage = (initialEntries: string[] = ['/explore']) =>
    render(
        <MemoryRouter initialEntries={initialEntries}>
            <MockThemeProvider>
                <ExplorePage />
            </MockThemeProvider>
        </MemoryRouter>
    );

describe('ExplorePage ONVOC filters', () => {
    it('renders three ONVOC category filters populated from the vocabulary JSON', () => {
        renderExplorePage();

        expect(screen.getByRole('heading', { name: 'Disorders' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Psychological Concepts' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Population Characteristics' })).toBeInTheDocument();

        expect(screen.getByTestId('onvoc-first-child-Disorders')).toHaveTextContent('Medical Disorders');
        expect(screen.getByTestId('onvoc-first-child-Psychological Concepts')).toHaveTextContent('Action');
        expect(screen.getByTestId('onvoc-first-child-Population Characteristics')).toHaveTextContent('Age');

        expect(Number(screen.getByTestId('onvoc-node-count-Disorders').textContent)).toBeGreaterThan(0);
        expect(Number(screen.getByTestId('onvoc-node-count-Psychological Concepts').textContent)).toBeGreaterThan(0);
        expect(Number(screen.getByTestId('onvoc-node-count-Population Characteristics').textContent)).toBeGreaterThan(0);
    });

    it('hydrates active search and type filters from the URL', () => {
        renderExplorePage(['/explore?q=hippocampus&type=PET']);

        expect(screen.getByText('Search: hippocampus')).toBeInTheDocument();
        expect(screen.getByText('Type: CBMA')).toBeInTheDocument();
        expect(screen.getByLabelText('Meta Analysis Type')).toHaveTextContent('CBMA');
    });
});
