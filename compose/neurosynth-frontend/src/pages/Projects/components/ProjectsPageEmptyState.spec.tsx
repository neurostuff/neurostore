import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsPageEmptyState from './ProjectsPageEmptyState';

// Isolate the empty-state UI from the CTA's dependency tree (Auth0/react-query/router).
vi.mock('components/Buttons/CreateProjectButton', () => ({
    default: () => <button data-testid="create-project-button">NEW PROJECT</button>,
}));

describe('ProjectsPageEmptyState', () => {
    it('should render', () => {
        render(<ProjectsPageEmptyState />);
    });

    it('should show the empty-state heading', () => {
        render(<ProjectsPageEmptyState />);
        expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('should show supporting guidance text', () => {
        render(<ProjectsPageEmptyState />);
        expect(screen.getByText(/create your first project/i)).toBeInTheDocument();
    });

    it('should render the create-project call-to-action', () => {
        render(<ProjectsPageEmptyState />);
        expect(screen.getByTestId('create-project-button')).toBeInTheDocument();
    });
});
