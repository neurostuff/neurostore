import { vi } from 'vitest';
import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavToolbar from './NavToolbar';

vi.mock('@auth0/auth0-react');
vi.mock('hooks');
vi.mock('react-router-dom');
vi.mock('components/Dialogs/CreateDetailsDialog');
vi.mock('components/Navbar/NavToolbarPopupSubMenu');

describe('NavToolbar Component', () => {
    beforeEach(() => {
        useAuth0().isAuthenticated = false;
    });

    const mockLogin = vi.fn();
    const mockLogout = vi.fn();
    it('should render', () => {
        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);
    });

    it('should show limited options when not authenticated', () => {
        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);

        expect(screen.queryByText('NEW PROJECT')).not.toBeInTheDocument();
        expect(screen.queryByText('my projects')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PersonIcon')).not.toBeInTheDocument();

        expect(screen.queryByText('explore')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
        expect(screen.queryByText('Sign In/Sign Up')).toBeInTheDocument();
    });

    it('should show the full list of options when authenticated', () => {
        useAuth0().isAuthenticated = true;

        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);

        expect(screen.queryByText('NEW PROJECT')).toBeInTheDocument();
        expect(screen.queryByText('my projects')).toBeInTheDocument();
        expect(screen.queryByText('explore')).toBeInTheDocument();
        expect(screen.queryByText('DOCS')).toBeInTheDocument();
        expect(screen.getByTestId('PersonIcon')).toBeInTheDocument();
    });

    it('should login', () => {
        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);

        userEvent.click(screen.getByText('Sign In/Sign Up'));
        expect(mockLogin).toHaveBeenCalled();
    });

    it('should logout', () => {
        useAuth0().isAuthenticated = true;

        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);

        // open popup
        userEvent.click(screen.getByTestId('PersonIcon'));
        userEvent.click(screen.getByText('Logout'));
        expect(mockLogout).toHaveBeenCalled();
    });

    it('should open the navpopup menu with the given menu items', () => {
        render(<NavToolbar onLogin={mockLogin} onLogout={mockLogout} />);

        userEvent.click(screen.getByTestId('mock-trigger-show-popup'));
        expect(screen.getByText('Studies')).toBeInTheDocument();
        expect(screen.getByText('Meta-Analyses')).toBeInTheDocument();
    });
});
