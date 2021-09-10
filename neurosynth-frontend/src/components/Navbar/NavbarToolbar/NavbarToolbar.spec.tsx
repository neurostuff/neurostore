import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NavOptionsModel } from '../Navbar';
import NavbarToolbar from './NavbarToolbar';

jest.mock('@auth0/auth0-react');

describe('NavbarToolbar Component', () => {
    const mockedUseAuth0 = {
        isAuthenticated: false,
    };

    const mockNavOptions: NavOptionsModel[] = [
        {
            label: 'testLabel1',
            path: 'testPath1',
        },
        {
            label: 'testLabel2',
            path: 'testPath2',
        },
        {
            label: 'testLabel3',
            path: 'testPath3',
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
            <BrowserRouter>
                <NavbarToolbar login={loginMock} logout={logoutMock} navOptions={mockNavOptions} />
            </BrowserRouter>
        );

        mockNavOptions.forEach((element) => {
            const buttonElement = screen.getByText(element.label);
            expect(buttonElement).toBeInTheDocument();
        });
    });

    it('should login with login is clicked', () => {
        render(
            <BrowserRouter>
                <NavbarToolbar login={loginMock} logout={logoutMock} navOptions={mockNavOptions} />
            </BrowserRouter>
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
            <BrowserRouter>
                <NavbarToolbar login={loginMock} logout={logoutMock} navOptions={mockNavOptions} />
            </BrowserRouter>
        );
        const loginButton = screen.getByText('Logout');
        expect(loginButton).toBeInTheDocument();
        userEvent.click(loginButton);
        expect(logoutMock).toBeCalled();
    });
});