import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NavOptionsModel } from '..';
import { MockThemeProvider } from '../../../testing/helpers';
import NavbarToolbar from './NavbarToolbar';

jest.mock('@auth0/auth0-react');

// already tested child component
jest.mock('../NavbarPopupMenu/NavbarPopupMenu', () => {
    return {
        __esModule: true,
        default: (props: any) => {
            return <button>child-menuitem</button>;
        },
    };
});

describe('NavbarToolbar Component', () => {
    const mockedUseAuth0 = {
        isAuthenticated: false,
    };

    const mockNavOptions: NavOptionsModel[] = [
        {
            label: 'testLabel1',
            path: 'testPath1',
            children: null,
        },
        {
            label: 'testLabel2',
            path: 'testPath2',
            children: null,
        },
        {
            label: 'testLabel3',
            path: 'testPath3',
            children: null,
        },
    ];

    const loginMock = jest.fn();
    const logoutMock = jest.fn();

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue(mockedUseAuth0);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <MockThemeProvider>
                <BrowserRouter>
                    <NavbarToolbar
                        login={loginMock}
                        logout={logoutMock}
                        navOptions={mockNavOptions}
                    />
                </BrowserRouter>
            </MockThemeProvider>
        );

        const menuItems = screen.getAllByText('child-menuitem');
        expect(menuItems.length).toEqual(mockNavOptions.length);
    });

    it('should login with login is clicked', () => {
        render(
            <MockThemeProvider>
                <BrowserRouter>
                    <NavbarToolbar
                        login={loginMock}
                        logout={logoutMock}
                        navOptions={mockNavOptions}
                    />
                </BrowserRouter>
            </MockThemeProvider>
        );
        const loginButton = screen.getByText('Login');
        expect(loginButton).toBeInTheDocument();
        userEvent.click(loginButton);
        expect(loginMock).toBeCalled();
    });

    it('should logout with logout is clicked', () => {
        const mockedUseAuth0 = {
            isAuthenticated: true,
        };

        (useAuth0 as any).mockReturnValue(mockedUseAuth0);

        render(
            <MockThemeProvider>
                <BrowserRouter>
                    <NavbarToolbar
                        login={loginMock}
                        logout={logoutMock}
                        navOptions={mockNavOptions}
                    />
                </BrowserRouter>
            </MockThemeProvider>
        );
        const loginButton = screen.getByText('Logout');
        expect(loginButton).toBeInTheDocument();
        userEvent.click(loginButton);
        expect(logoutMock).toBeCalled();
    });
});
