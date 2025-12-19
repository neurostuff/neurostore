import { vi } from 'vitest';
import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';

vi.mock('@auth0/auth0-react');
vi.mock('react-router-dom');
vi.mock('components/Navbar/NavDrawer.tsx');
vi.mock('components/Navbar/NavToolbar.tsx');
vi.mock('hooks');

describe('Navbar', () => {
    it('should render', () => {
        render(<Navbar />);

        expect(screen.getByTestId('mock-nav-drawer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-nav-toolbar')).toBeInTheDocument();
    });

    it('should call the auth0 login method when logging in', () => {
        render(<Navbar />);

        userEvent.click(screen.getByTestId('toolbar-trigger-login'));

        expect(useAuth0().getAccessTokenWithPopup).toHaveBeenCalled();
    });

    it('should call the auth0 logout method when logging out', () => {
        render(<Navbar />);

        userEvent.click(screen.getByTestId('toolbar-trigger-logout'));

        expect(useAuth0().logout).toHaveBeenCalled();
    });
});
