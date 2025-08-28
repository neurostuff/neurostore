import { vi, Mock } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProtectedProjectRoute from './ProtectedProjectRoute';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useGetProjectById, useUserCanEdit } from 'hooks';
import { useGetProjectIsLoading } from 'pages/Project/store/ProjectStore';

vi.mock('react-router-dom', async () => {
    const actualReactRouterDom = await vi.importActual('react-router-dom');
    return {
        ...actualReactRouterDom,
    };
});
vi.mock('pages/Project/store/ProjectStore', async () => {
    return {
        useInitProjectStoreIfRequired: vi.fn(),
        useGetProjectIsLoading: vi.fn(),
    };
});
vi.mock('hooks');
vi.mock('@auth0/auth0-react');
vi.mock('notistack');
vi.mock('components/NeurosynthLoader/NeurosynthLoader');

describe('ProtectedProjectRoute Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.clearAllMocks();

        (useGetProjectIsLoading as Mock).mockReturnValue(false);
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: false,
            user: undefined,
        });
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('should render', () => {
        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );
    });

    it('should allow access if the user is the owner', () => {
        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if the user is the owner and the onlyOwnerCanAccess flag is set', () => {
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: true,
            user: undefined,
        });
        (useUserCanEdit as Mock).mockReturnValue(true);
        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if public and the user is not the owner', () => {
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: true,
            user: { sub: 'other-user' },
        });
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if public and the user is not authenticated', () => {
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should not allow access if its not public and the user is not the owner', () => {
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: true,
            user: { sub: 'other-user' },
        });
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should not allow access if its not public and the user is not authenticated', () => {
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should not allow access if the onlyOwnerCanAccess flag is set and the user is not the owner', () => {
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: true,
            user: { sub: 'other-user' },
        });
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should throw an error if there is an error', () => {
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
            isError: true,
        });
        window.console.error = vi.fn(); // suppress error

        expect(() =>
            render(
                <MemoryRouter>
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
                </MemoryRouter>
            )
        ).toThrow();
    });

    it('should load', () => {
        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: true,
            user: { sub: 'other-user' },
        });
        (useGetProjectById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: true,
            isError: false,
        });

        render(
            <MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
    });
});
