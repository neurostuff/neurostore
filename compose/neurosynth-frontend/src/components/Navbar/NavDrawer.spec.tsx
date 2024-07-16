import { useAuth0 } from '@auth0/auth0-react';
import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavDrawer from './NavDrawer';

jest.mock('@auth0/auth0-react');
jest.mock('react-router-dom');
jest.mock('components/Dialogs/CreateDetailsDialog');

describe('NavDrawer component', () => {
    let renderResult: RenderResult;

    const mockOnLogin = jest.fn();
    const mockOnLogout = jest.fn();

    beforeEach(() => {
        useAuth0().isAuthenticated = false;

        renderResult = render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        userEvent.click(screen.getByTestId('MenuIcon'));
    });

    it('should render', () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);
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

        renderResult.rerender(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

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

        renderResult.rerender(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        userEvent.click(screen.getByText('LOGOUT'));
        expect(mockOnLogout).toHaveBeenCalled();
    });

    it('should show the menu with the given menu items', () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

        expect(screen.queryByText('STUDIES')).not.toBeInTheDocument();
        expect(screen.queryByText('META-ANALYSES')).not.toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('STUDIES')).toBeInTheDocument();
        expect(screen.getByText('META-ANALYSES')).toBeInTheDocument();
    });

    it('should hide the menu with the given menu items', () => {
        render(<NavDrawer onLogin={mockOnLogin} onLogout={mockOnLogout} />);

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
