import { vi, Mock } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProtectedMetaAnalysisRoute from './ProtectedMetaAnalysisRoute';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';

vi.mock('react-router-dom', async () => {
    const actualReactRouterDom = await vi.importActual('react-router-dom');
    return {
        ...actualReactRouterDom,
    };
});
vi.mock('hooks');
vi.mock('@auth0/auth0-react');
vi.mock('notistack');
vi.mock('components/NeurosynthLoader/NeurosynthLoader');

describe('ProtectedMetaAnalysisRoute Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.clearAllMocks();

        (useAuth0 as Mock).mockReturnValue({
            isAuthenticated: false,
            user: undefined,
            isLoading: false,
        });
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
        });
        (useUserCanEdit as Mock).mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it('should allow access if the user is the owner', () => {
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedMetaAnalysisRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should allow access if public and the user is not the owner', () => {
        render(
            <MemoryRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedMetaAnalysisRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('allowed')).toBeInTheDocument();
    });

    it('should not allow access if it is private and the user is not the owner', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedMetaAnalysisRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should not allow access if it is private and the user is not authenticated', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: { public: false },
            isLoading: false,
        });

        render(
            <MemoryRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedMetaAnalysisRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('forbidden')).toBeInTheDocument();
    });

    it('should throw an error if there is an error', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: { public: true },
            isLoading: false,
            isError: true,
        });
        window.console.error = vi.fn();

        expect(() =>
            render(
                <MemoryRouter>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                    <div>allowed</div>
                                </ProtectedMetaAnalysisRoute>
                            }
                        />
                        <Route path="/forbidden" element={<div>forbidden</div>} />
                    </Routes>
                </MemoryRouter>
            )
        ).toThrow();
    });

    it('should load', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
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
                            <ProtectedMetaAnalysisRoute errorMessage="Not allowed">
                                <div>allowed</div>
                            </ProtectedMetaAnalysisRoute>
                        }
                    />
                    <Route path="/forbidden" element={<div>forbidden</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
    });
});
