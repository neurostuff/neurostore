import { vi, Mock } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AnnotationGuard from './AnnotationGuard';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGetAnnotationById } from 'hooks';
import { useGetProjectIsLoading, useInitProjectStoreIfRequired, useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';
import { useInitAnnotationStoreIfRequired } from 'stores/annotation/AnnotationStore.actions';
import { useGetAnnotationIsLoading } from 'stores/annotation/AnnotationStore.getters';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual };
});

vi.mock('stores/projects/ProjectStore', () => ({
    useInitProjectStoreIfRequired: vi.fn(),
    useGetProjectIsLoading: vi.fn(),
    useProjectExtractionAnnotationId: vi.fn(),
}));

vi.mock('stores/annotation/AnnotationStore.actions', () => ({
    useInitAnnotationStoreIfRequired: vi.fn(),
}));

vi.mock('stores/annotation/AnnotationStore.getters', () => ({
    useGetAnnotationIsLoading: vi.fn(),
}));

vi.mock('hooks', async () => {
    const actual = await vi.importActual<typeof import('hooks')>('hooks');
    return {
        ...actual,
        useGetAnnotationById: vi.fn(),
    };
});

vi.mock('components/NeurosynthLoader/NeurosynthLoader');

const defaultAnnotationQuery = {
    data: { id: 'ann-1' },
    isLoading: false,
    isError: false,
    error: null,
};

describe('AnnotationGuard', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.clearAllMocks();

        (useInitProjectStoreIfRequired as Mock).mockImplementation(() => {});
        (useInitAnnotationStoreIfRequired as Mock).mockImplementation(() => {});
        (useGetProjectIsLoading as Mock).mockReturnValue(false);
        (useProjectExtractionAnnotationId as Mock).mockReturnValue('annotation-id-1');
        (useGetAnnotationIsLoading as Mock).mockReturnValue(false);
        (useGetAnnotationById as Mock).mockReturnValue(defaultAnnotationQuery);
    });

    afterEach(() => {
        cleanup();
    });

    const renderGuard = (ui = <div>child content</div>) =>
        render(
            <MemoryRouter>
                <Routes>
                    <Route path="/" element={<AnnotationGuard>{ui}</AnnotationGuard>} />
                </Routes>
            </MemoryRouter>
        );

    it('renders children when project, annotation query, and annotation store are ready', () => {
        renderGuard();
        expect(screen.getByText('child content')).toBeInTheDocument();
    });

    it('shows loader while project store reports loading', () => {
        (useGetProjectIsLoading as Mock).mockReturnValue(true);
        renderGuard();
        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
        expect(screen.queryByText('child content')).not.toBeInTheDocument();
    });

    it('shows loader while annotation query is loading', () => {
        (useGetAnnotationById as Mock).mockReturnValue({
            ...defaultAnnotationQuery,
            isLoading: true,
        });
        renderGuard();
        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
    });

    it('shows loader while annotation store is loading', () => {
        (useGetAnnotationIsLoading as Mock).mockReturnValue(true);
        renderGuard();
        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
    });

    it('throws when annotation query fails', () => {
        const apiError = { message: 'not found' };
        (useGetAnnotationById as Mock).mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: apiError,
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => renderGuard()).toThrow(JSON.stringify(apiError));

        consoleSpy.mockRestore();
    });
});
