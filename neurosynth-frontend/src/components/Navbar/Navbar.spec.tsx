import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavbarArgs } from '.';
import { Navbar } from '..';

jest.mock('@auth0/auth0-react');

// mock navbar drawer
jest.mock('./NavbarDrawer/NavbarDrawer', () => {
    return {
        __esModule: true,
        default: (props: NavbarArgs) => {
            return <></>;
        },
    };
});

// mock navbar tool bar
jest.mock('./NavbarToolbar/NavbarToolbar', () => {
    return {
        __esModule: true,
        default: (props: NavbarArgs) => {
            return (
                <div>
                    <button onClick={props.login} data-testid="login">
                        login
                    </button>
                    <button onClick={props.logout} data-testid="logout">
                        logout
                    </button>
                </div>
            );
        },
    };
});

describe('Navbar', () => {
    const mockLoginWithPopupFunc = jest.fn();
    const mockLogoutFunc = jest.fn();
    const mockGetAccessTokenSilently = jest.fn();

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            loginWithPopup: mockLoginWithPopupFunc,
            logout: mockLogoutFunc,
        });
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

        expect(mockLoginWithPopupFunc).toBeCalled();
    });

    it('should call the auth0 login method when logging in', () => {
        render(<Navbar />);

        const logoutButton = screen.getByTestId('logout');
        userEvent.click(logoutButton);

        expect(mockLogoutFunc).toBeCalled();
    });
});
