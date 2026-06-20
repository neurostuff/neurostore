import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockThemeProvider } from 'testing/helpers';
import ProjectsPageEmptyState from './ProjectsPageEmptyState';

// Isolate the empty-state UI from the CTA's dependency tree (Auth0/react-query/router).
vi.mock('components/Buttons/CreateProjectButton', () => ({
    default: () => <button data-testid="create-project-button">NEW PROJECT</button>,
}));

// Render within the app theme so the component resolves palette tokens (e.g. muted.main)
// the same way it does in production.
const renderEmptyState = () =>
    render(
        <MockThemeProvider>
            <ProjectsPageEmptyState />
        </MockThemeProvider>
    );

describe('ProjectsPageEmptyState', () => {
    it('should render', () => {
        renderEmptyState();
    });

    it('should show the empty-state heading', () => {
        renderEmptyState();
        expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('should show supporting guidance text', () => {
        renderEmptyState();
        expect(screen.getByText(/create your first project/i)).toBeInTheDocument();
    });

    it('should render the create-project call-to-action', () => {
        renderEmptyState();
        expect(screen.getByTestId('create-project-button')).toBeInTheDocument();
    });
});
