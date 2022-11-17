import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';

jest.mock('@auth0/auth0-react');
jest.mock('components/Navbar/NavDrawer/NavDrawer.tsx');
jest.mock('components/Navbar/NavToolbar/NavToolbar.tsx');

describe('Navbar', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(<Navbar />);

        expect(screen.getByTestId('mock-nav-drawer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-nav-toolbar')).toBeInTheDocument();
    });

    it('should call the auth0 login method when logging in', () => {
        render(<Navbar />);

        userEvent.click(screen.getByTestId('drawer-trigger-login'));

        expect(useAuth0().loginWithPopup).toHaveBeenCalled();
    });

    it('should call the auth0 login method when logging out', () => {
        render(<Navbar />);

        userEvent.click(screen.getByTestId('drawer-trigger-logout'));

        expect(useAuth0().logout).toHaveBeenCalled();
    });
});
