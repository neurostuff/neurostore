import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavToolbar from './NavToolbar';

jest.mock('@auth0/auth0-react');
jest.mock('hooks');
jest.mock('components/Dialogs/CreateDetailsDialog/CreateDetailsDialog');
jest.mock('components/Navbar/NavSubMenu/NavToolbarPopupSubMenu');

describe('NavToolbar Component', () => {
    beforeEach(() => {
        useAuth0().isAuthenticated = false;
    });

    const mockLogin = jest.fn();
    const mockLogout = jest.fn();
    const mockOnCreateProject = jest.fn();
    it('should render', () => {
        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );
    });

    it('should show limited options when not authenticated', () => {
        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByText('NEW PROJECT')).not.toBeInTheDocument();
        expect(screen.queryByText('my projects')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PersonIcon')).not.toBeInTheDocument();

        expect(screen.queryByText('explore')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
        expect(screen.queryByText('SIGN IN/SIGN UP')).toBeInTheDocument();
    });

    it('should show the full list of options when authenticated', () => {
        useAuth0().isAuthenticated = true;

        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByText('NEW PROJECT')).toBeInTheDocument();
        expect(screen.queryByText('my projects')).toBeInTheDocument();
        expect(screen.queryByText('explore')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
        expect(screen.getByTestId('PersonIcon')).toBeInTheDocument();
    });

    it('should login', () => {
        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('SIGN IN/SIGN UP'));
        expect(mockLogin).toHaveBeenCalled();
    });

    it('should logout', () => {
        useAuth0().isAuthenticated = true;

        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        // open popup
        userEvent.click(screen.getByTestId('PersonIcon'));
        userEvent.click(screen.getByText('LOGOUT'));
        expect(mockLogout).toHaveBeenCalled();
    });

    it('should create a new project on click', () => {
        useAuth0().isAuthenticated = true;

        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('NEW PROJECT'));
        expect(mockOnCreateProject).toHaveBeenCalledWith('Untitled', '');
    });

    it('should show the loading icon', () => {
        useAuth0().isAuthenticated = true;

        render(
            <BrowserRouter>
                <NavToolbar
                    createProjectIsLoading={true}
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not show the loading icon', () => {
        useAuth0().isAuthenticated = true;

        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should open the navpopup menu with the given menu items', () => {
        render(
            <BrowserRouter>
                <NavToolbar
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockLogin}
                    onLogout={mockLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByTestId('mock-trigger-show-popup'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
    });
});
