import { useAuth0 } from '@auth0/auth0-react';
import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavDrawer from './NavDrawer';

jest.mock('@auth0/auth0-react');
jest.mock('components/Dialogs/CreateDetailsDialog/CreateDetailsDialog');

describe('NavDrawer component', () => {
    let renderResult: RenderResult;

    const mockLogin = jest.fn();
    const mockLogout = jest.fn();

    beforeEach(() => {
        useAuth0().isAuthenticated = false;

        renderResult = render(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        userEvent.click(screen.getByTestId('MenuIcon'));
    });

    it('should render', () => {
        render(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );
    });

    it('should open the drawer', () => {
        expect(screen.queryByRole('presentation')).toBeInTheDocument();
    });

    it('should show limited options when not authenticated', () => {
        expect(screen.queryByText('new project')).not.toBeInTheDocument();
        expect(screen.queryByText('my projects')).not.toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).not.toBeInTheDocument();

        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('HELP')).toBeInTheDocument();
        expect(screen.queryByText('SIGN IN/SIGN UP')).toBeInTheDocument();
    });

    it('should show the full range of options when authenticated', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        expect(screen.queryByText('NEW PROJECT')).toBeInTheDocument();
        expect(screen.queryByText('MY PROJECTS')).toBeInTheDocument();
        expect(screen.queryByText('LOGOUT')).toBeInTheDocument();
        expect(screen.queryByText('EXPLORE')).toBeInTheDocument();
        expect(screen.queryByText('HELP')).toBeInTheDocument();
    });

    it('should login', () => {
        const signInButton = screen.getByText('SIGN IN/SIGN UP');
        userEvent.click(signInButton);

        expect(mockLogin).toHaveBeenCalled();
    });

    it('should logout', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('LOGOUT'));
        expect(mockLogout).toHaveBeenCalled();
    });

    it('should open the dialog when creating a new project', () => {
        useAuth0().isAuthenticated = true;

        renderResult.rerender(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        userEvent.click(screen.getByText('NEW PROJECT'));

        expect(screen.getByTestId('mock-create-details-dialog')).toBeInTheDocument();
    });
    it('should show the menu with the given menu items', () => {
        render(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        expect(screen.queryByText('studies')).not.toBeInTheDocument();
        expect(screen.queryByText('studysets')).not.toBeInTheDocument();
        expect(screen.queryByText('meta-analyses')).not.toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('studies')).toBeInTheDocument();
        expect(screen.getByText('studysets')).toBeInTheDocument();
        expect(screen.getByText('meta-analyses')).toBeInTheDocument();
    });

    it('should hide the menu with the given menu items', () => {
        render(
            <BrowserRouter>
                <NavDrawer login={mockLogin} logout={mockLogout} />
            </BrowserRouter>
        );

        expect(screen.queryByText('studies')).not.toBeInTheDocument();
        expect(screen.queryByText('studysets')).not.toBeInTheDocument();
        expect(screen.queryByText('meta-analyses')).not.toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.getByText('studies')).toBeInTheDocument();
        expect(screen.getByText('studysets')).toBeInTheDocument();
        expect(screen.getByText('meta-analyses')).toBeInTheDocument();
        userEvent.click(screen.getByText('EXPLORE'));
        expect(screen.queryByText('studies')).not.toBeInTheDocument();
        expect(screen.queryByText('studysets')).not.toBeInTheDocument();
        expect(screen.queryByText('meta-analyses')).not.toBeInTheDocument();
    });
});
