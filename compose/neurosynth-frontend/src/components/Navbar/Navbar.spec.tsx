import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '..';

jest.mock('@auth0/auth0-react');

// mock navbar tool bar
jest.mock('./NavbarToolbar/NavbarToolbar');

describe('Navbar', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(<Navbar />);
        const loginButton = screen.getByTestId('login');
        const logoutButton = screen.getByTestId('logout');

        expect(loginButton).toBeInTheDocument();
        expect(logoutButton).toBeInTheDocument();
    });

    it('should call the auth0 login method when logging in', () => {
        render(<Navbar />);

        const loginButton = screen.getByTestId('login');
        userEvent.click(loginButton);

        expect(useAuth0().loginWithPopup).toBeCalled();
    });

    it('should call the auth0 login method when logging in', () => {
        render(<Navbar />);

        const logoutButton = screen.getByTestId('logout');
        userEvent.click(logoutButton);

        expect(useAuth0().logout).toBeCalled();
    });
});
