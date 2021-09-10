import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NavOptionsModel } from '../Navbar';
import NavbarDrawer from './NavbarDrawer';

jest.mock('@auth0/auth0-react');

describe('NavbarDrawer Component', () => {
    const mockedUseAuth0 = {
        isAuthenticated: true,
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

        render(
            <BrowserRouter>
                <NavbarDrawer login={loginMock} logout={logoutMock} navOptions={mockNavOptions} />
            </BrowserRouter>
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const button = screen.getByRole('button');
        expect(button).toBeTruthy();

        const titleElement = screen.getByText(/neurosynth/i);
        expect(titleElement).toBeInTheDocument();
    });

    it('should open the drawer when clicked', () => {
        const button = screen.getByRole('button');
        userEvent.click(button);

        mockNavOptions.forEach((element) => {
            const buttonElement = screen.getByText(element.label);
            expect(buttonElement).toBeInTheDocument();
        });
    });

    it('should show login if not authenticated and login on click', () => {
        const mockedAuth0 = {
            isAuthenticated: false,
        };

        (useAuth0 as any).mockReturnValue(mockedAuth0);

        const button = screen.getByRole('button');
        userEvent.click(button);

        const loginButton = screen.getByText('Login');
        expect(loginButton).toBeInTheDocument();

        userEvent.click(loginButton);
        expect(loginMock).toBeCalled();
    });

    it('should show logout if authenticated and logout on click', () => {
        const button = screen.getByRole('button');
        userEvent.click(button);

        const logoutButton = screen.getByText('Logout');
        expect(logoutButton).toBeInTheDocument();

        userEvent.click(logoutButton);
        expect(logoutMock).toBeCalled();
    });
});
