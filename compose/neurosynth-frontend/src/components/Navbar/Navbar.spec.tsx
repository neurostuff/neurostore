import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Router } from 'react-router-dom';

jest.mock('@auth0/auth0-react');
jest.mock('components/Navbar/NavDrawer/NavDrawer.tsx');
jest.mock('components/Navbar/NavToolbar/NavToolbar.tsx');
jest.mock('hooks');

describe('Navbar', () => {
    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    afterAll(() => {
        jest.clearAllMocks();
    });

    const queryClient = new QueryClient();

    it('should render', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <Router history={historyMock as any}>
                    <Navbar />
                </Router>
            </QueryClientProvider>
        );

        expect(screen.getByTestId('mock-nav-drawer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-nav-toolbar')).toBeInTheDocument();
    });

    it('should call the auth0 login method when logging in', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <Router history={historyMock as any}>
                    <Navbar />
                </Router>
            </QueryClientProvider>
        );

        userEvent.click(screen.getByTestId('toolbar-trigger-login'));

        expect(useAuth0().loginWithPopup).toHaveBeenCalled();
    });

    it('should call the auth0 logout method when logging out', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <Router history={historyMock as any}>
                    <Navbar />
                </Router>
            </QueryClientProvider>
        );

        userEvent.click(screen.getByTestId('toolbar-trigger-logout'));

        expect(useAuth0().logout).toHaveBeenCalled();
    });
});
