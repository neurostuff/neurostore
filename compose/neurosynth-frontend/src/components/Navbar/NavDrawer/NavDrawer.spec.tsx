import { useAuth0 } from '@auth0/auth0-react';
import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavDrawer from './NavDrawer';

jest.mock('@auth0/auth0-react');
jest.mock('components/Dialogs/CreateDetailsDialog/CreateDetailsDialog');

describe('NavDrawer component', () => {
    let renderResult: RenderResult;

    const mockOnLogin = jest.fn();
    const mockOnLogout = jest.fn();
    const mockOnCreateProject = jest.fn();

    beforeEach(() => {
        useAuth0().isAuthenticated = false;

        renderResult = render(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByTestId('MenuIcon'));
    });

    it('should render', () => {
        render(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );
    });

    it('should open the drawer', () => {
        expect(screen.queryByRole('presentation')).toBeInTheDocument();
    });

    it('should show limited options when not authenticated', () => {
        expect(screen.queryByText('new project')).not.toBeInTheDocument();
        expect(screen.queryByText('my projects')).not.toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).not.toBeInTheDocument();

        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
        expect(screen.queryByText('SIGN IN/SIGN UP')).toBeInTheDocument();
    });

    it('should show the full range of options when authenticated', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByText('NEW PROJECT')).toBeInTheDocument();
        expect(screen.queryByText('MY PROJECTS')).toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).toBeInTheDocument();
        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
    });

    it('should login', () => {
        const signInButton = screen.getByText('SIGN IN/SIGN UP');
        userEvent.click(signInButton);

        expect(mockOnLogin).toHaveBeenCalled();
    });

    it('should logout', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('LOGOUT'));
        expect(mockOnLogout).toHaveBeenCalled();
    });

    it('should open the dialog when creating a new project', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('NEW PROJECT'));

        expect(screen.getByTestId('mock-create-details-dialog')).toBeInTheDocument();
    });

    it('should create a new project', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('NEW PROJECT'));
        expect(screen.getByTestId('mock-create-details-dialog')).toBeInTheDocument();
        userEvent.click(screen.getByTestId('mock-create-button'));

        expect(mockOnCreateProject).toHaveBeenCalledWith('test name', 'test description');
    });

    it('should show the menu with the given menu items', () => {
        render(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
    });

    it('should hide the menu with the given menu items', () => {
        render(
            <BrowserRouter>
                <NavDrawer
                    onCreateProject={mockOnCreateProject}
                    onLogin={mockOnLogin}
                    onLogout={mockOnLogout}
                />
            </BrowserRouter>
        );

        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
    });
});
