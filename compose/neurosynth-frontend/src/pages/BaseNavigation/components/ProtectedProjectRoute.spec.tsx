import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedProjectRoute from './ProtectedProjectRoute';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useGetProjectById } from 'hooks';

vi.mock('react-router-dom', async () => {
    const actualReactRouterDom = await vi.importActual('react-router-dom');
    return {
        ...actualReactRouterDom
    }
})
vi.mock('hooks');
vi.mock('@auth0/auth0-react');

describe('ProtectedProjectRoute Component', () => {
    it('should render', () => {
        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute>
                                <div>test </div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );
    });

    it('should allow access if the user is the owner', () => {
        useAuth0().isAuthenticated = true;
        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if the user is the owner and the onlyOwnerCanAccess flag is set', () => {
        useAuth0().isAuthenticated = true;
        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute onlyOwnerCanAccess errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if public and the user is not the owner', () => {
        useAuth0().isAuthenticated = true;
        useAuth0().user = { sub: 'other-user' };
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });

        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if public and the user is not authenticated', () => {
        useAuth0().isAuthenticated = false;
        useAuth0().user = undefined;
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });

        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should not allow access if its not public and the user is not the owner', () => {
        useAuth0().isAuthenticated = true;
        useAuth0().user = { sub: 'other-user' };
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should not allow access if its not public and the user is not authenticated', () => {
        useAuth0().isAuthenticated = false;
        useAuth0().user = undefined;
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should not allow access if the onlyOwnerCanAccess flag is set and the user is not the owner', () => {
        useAuth0().isAuthenticated = true;
        useAuth0().user = { sub: 'other-user' };
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedProjectRoute onlyOwnerCanAccess errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </BrowserRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });
});
