import { Mock, vi } from 'vitest';
import { useAuth0 } from '@auth0/auth0-react';
import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCreateProject } from 'hooks';
import { clearUnloadHandlers } from 'helpers/BeforeUnload.helpers';
import { useNavigate } from 'react-router-dom';
import NavDrawer from './NavDrawer';

const { mockMutate, mockProjectsSearchHelper } = vi.hoisted(() => ({
    mockMutate: vi.fn(),
    mockProjectsSearchHelper: vi.fn().mockResolvedValue({ data: { results: [] } }),
}));

vi.mock('@auth0/auth0-react');
vi.mock('react-router-dom');
vi.mock('hooks');
vi.mock('hooks/projects/useGetProjects', async (importOriginal) => {
    const actual = await importOriginal<typeof import('hooks/projects/useGetProjects')>();
    return {
        ...actual,
        projectsSearchHelper: mockProjectsSearchHelper,
    };
});
vi.mock('components/Dialogs/CreateDetailsDialog');
vi.mock('components/Dialogs/ConfirmationDialog');

describe('NavDrawer component', () => {
    let renderResult: RenderResult;

    const mockOnLogin = vi.fn();
    const mockOnLogout = vi.fn();

    beforeEach(async () => {
        vi.clearAllMocks();
        clearUnloadHandlers();
        useAuth0().isAuthenticated = false;
        mockProjectsSearchHelper.mockResolvedValue({ data: { results: [] } });
        mockMutate.mockImplementation((_project, options) => {
            options?.onSuccess?.({ data: { id: 'new-project-id' } });
        });
        (useCreateProject as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            mutate: mockMutate,
        });

        renderResult = render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        await userEvent.click(screen.getByTestId('MenuIcon'));
    });

    it('should render', async () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);
    });

    it('should open the drawer', async () => {
        expect(screen.queryByRole('presentation')).toBeInTheDocument();
    });

    it('should show limited options when not authenticated', async () => {
        expect(screen.queryByText('new project')).not.toBeInTheDocument();
        expect(screen.queryByText('my projects')).not.toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).not.toBeInTheDocument();

        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('Help')).toBeInTheDocument();
        expect(screen.queryByText('SIGN IN/SIGN UP')).toBeInTheDocument();
    });

    it('should show the full range of options when authenticated', async () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        expect(screen.queryByText('NEW PROJECT')).toBeInTheDocument();
        expect(screen.queryByText('MY PROJECTS')).toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).toBeInTheDocument();
        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('Help')).toBeInTheDocument();
    });

    it('creates a new project when NEW PROJECT is clicked', async () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        const [, createProjectButton] = screen.getAllByRole('button', { name: 'NEW PROJECT' });
        expect(createProjectButton?.tagName).toBe('BUTTON');
        await userEvent.click(createProjectButton!);

        await waitFor(() => {
            expect(mockProjectsSearchHelper).toHaveBeenCalled();
            expect(mockMutate).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Untitled' }),
                expect.objectContaining({ onSuccess: expect.any(Function) })
            );
        });
        expect(useNavigate()).toHaveBeenCalledWith('/projects/new-project-id');
    });

    it('should login', async () => {
        const signInButton = screen.getByText('SIGN IN/SIGN UP');
        await userEvent.click(signInButton);

        expect(mockOnLogin).toHaveBeenCalled();
    });

    it('should logout', async () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        await userEvent.click(screen.getByText('LOGOUT'));
        expect(mockOnLogout).toHaveBeenCalled();
    });

    it('should show the menu with the given menu items', async () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
    });

    it('should hide the menu with the given menu items', async () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
        await userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
    });
});
