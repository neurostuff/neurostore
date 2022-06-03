import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NavOptionsModel } from '..';
import NavbarDrawer from './NavbarDrawer';

// already tested child component
jest.mock('../NavbarPopupMenu/NavbarPopupMenu');
jest.mock('@auth0/auth0-react');

describe('NavbarDrawer Component', () => {
    const mockNavOptions: NavOptionsModel[] = [
        {
            label: 'testLabel1',
            path: 'testPath1',
            disabled: false,
            authenticationRequired: false,
            children: null,
        },
        {
            label: 'testLabel2',
            path: 'testPath2',
            disabled: false,
            authenticationRequired: false,
            children: null,
        },
        {
            label: 'testLabel3',
            path: 'testPath3',
            disabled: false,
            authenticationRequired: false,
            children: null,
        },
    ];

    const loginMock = jest.fn();
    const logoutMock = jest.fn();

    beforeEach(() => {
        useAuth0().isAuthenticated = true;

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
        const button = screen.getByTestId('MenuIcon');
        expect(button).toBeTruthy();

        const titleElement = screen.getByText(/neurosynth/i);
        expect(titleElement).toBeInTheDocument();
    });

    it('should open the drawer when clicked', () => {
        const button = screen.getByTestId('MenuIcon');
        userEvent.click(button);

        const mockedOptions = screen.getAllByText('child-menuitem');
        expect(mockNavOptions.length).toEqual(mockedOptions.length);
    });

    it('should show login if not authenticated and login on click', () => {
        useAuth0().isAuthenticated = false;

        const button = screen.getByTestId('MenuIcon');
        userEvent.click(button);

        const loginButton = screen.getByText('Sign in/Sign up');
        expect(loginButton).toBeInTheDocument();

        userEvent.click(loginButton);
        expect(loginMock).toBeCalled();
    });

    it('should show logout if authenticated and logout on click', () => {
        const button = screen.getByTestId('MenuIcon');
        userEvent.click(button);

        const logoutButton = screen.getByText('Logout');
        expect(logoutButton).toBeInTheDocument();

        userEvent.click(logoutButton);
        expect(logoutMock).toBeCalled();
    });
});
