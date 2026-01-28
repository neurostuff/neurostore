import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDangerZone from './ProjectDangerZone';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useDeleteStudyset } from 'hooks';
import useDeleteProject from 'hooks/projects/useDeleteProject';
import useUserCanEdit from 'hooks/useUserCanEdit';
import {
    useClearProvenance,
    useProjectExtractionStudysetId,
    useProjectMetaAnalyses,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';

// Mock all the dependencies
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
        useParams: vi.fn(),
    };
});

vi.mock('notistack', () => ({
    useSnackbar: vi.fn(),
}));

vi.mock('hooks', () => ({
    useDeleteStudyset: vi.fn(),
}));

vi.mock('hooks/projects/useDeleteProject', () => ({
    default: vi.fn(),
}));

vi.mock('hooks/useUserCanEdit', () => ({
    default: vi.fn(),
}));

vi.mock('pages/Project/store/ProjectStore', () => ({
    useProjectUser: vi.fn(),
    useClearProvenance: vi.fn(),
    useProjectExtractionStudysetId: vi.fn(),
    useProjectMetaAnalyses: vi.fn(),
}));

const mockedUseNavigate = vi.mocked(useNavigate);
const mockedUseSnackbar = vi.mocked(useSnackbar);
const mockedUseParams = vi.mocked(useParams);
const mockedUseDeleteProject = vi.mocked(useDeleteProject);
const mockedUseDeleteStudyset = vi.mocked(useDeleteStudyset);
const mockedUseClearProvenance = vi.mocked(useClearProvenance);
const mockedUseProjectUser = vi.mocked(useProjectUser);
const mockedUseProjectExtractionStudysetId = vi.mocked(useProjectExtractionStudysetId);
const mockedUseProjectMetaAnalyses = vi.mocked(useProjectMetaAnalyses);
const mockedUseUserCanEdit = vi.mocked(useUserCanEdit);

describe('ProjectDangerZone', () => {
    const mockNavigate = vi.fn();
    const mockEnqueueSnackbar = vi.fn();
    const mockDeleteProject = vi.fn();
    const mockDeleteStudyset = vi.fn();
    const mockClearProvenance = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockedUseNavigate.mockReturnValue(mockNavigate);
        mockedUseSnackbar.mockReturnValue({
            enqueueSnackbar: mockEnqueueSnackbar,
            closeSnackbar: vi.fn(),
        } as ReturnType<typeof useSnackbar>);
        mockedUseParams.mockReturnValue({ projectId: 'test-project-id' });
        mockedUseDeleteProject.mockReturnValue({
            mutate: mockDeleteProject,
            isLoading: false,
            isError: false,
            isSuccess: false,
            isIdle: true,
        } as unknown as ReturnType<typeof useDeleteProject>);
        mockedUseDeleteStudyset.mockReturnValue({
            mutateAsync: mockDeleteStudyset,
            isLoading: false,
            isError: false,
            isSuccess: false,
            isIdle: true,
        } as unknown as ReturnType<typeof useDeleteStudyset>);
        mockedUseClearProvenance.mockReturnValue(mockClearProvenance);
        mockedUseProjectUser.mockReturnValue('test-user');
        mockedUseProjectExtractionStudysetId.mockReturnValue('test-studyset-id');
        mockedUseProjectMetaAnalyses.mockReturnValue([]);
        mockedUseUserCanEdit.mockReturnValue(true);

        // Mock window.location.hostname
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hostname: 'localhost' },
        });

        import.meta.env.VITE_APP_ENV = 'DEV';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Rendering', () => {
        it('should render the danger zone when user can edit', () => {
            render(<ProjectDangerZone />);

            expect(screen.getByText('Danger zone')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /delete this project/i })).toBeInTheDocument();
        });

        it('should not render anything when user cannot edit', () => {
            mockedUseUserCanEdit.mockReturnValue(false);

            const { container } = render(<ProjectDangerZone />);
            expect(container).toBeEmptyDOMElement();
        });

        it('should render disabled button with warning text when project has meta-analyses', () => {
            mockedUseProjectMetaAnalyses.mockReturnValue(['meta-analysis-1', 'meta-analysis-2']);

            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', {
                name: /this project has associated meta-analyses and cannot be deleted/i,
            });
            expect(deleteButton).toBeInTheDocument();
            expect(deleteButton).toBeDisabled();
        });

        it('should render enabled button when project has no meta-analyses', () => {
            mockedUseProjectMetaAnalyses.mockReturnValue([]);

            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', { name: /delete this project/i });
            expect(deleteButton).toBeInTheDocument();
            expect(deleteButton).not.toBeDisabled();
        });
    });

    describe('Delete Project Flow', () => {
        it('should open confirmation dialog when delete button is clicked', () => {
            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', { name: /delete this project/i });
            userEvent.click(deleteButton);

            expect(screen.getByText('Are you sure you want to delete the project?')).toBeInTheDocument();
            expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
        });

        it('should close dialog when cancel is clicked', () => {
            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', { name: /delete this project/i });
            userEvent.click(deleteButton);

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            userEvent.click(cancelButton);

            waitFor(() => {
                expect(screen.queryByText('Are you sure you want to delete the project?')).not.toBeInTheDocument();
            });
        });

        it('should delete project and navigate when confirmed', () => {
            let onSuccessCallback: (() => void) | undefined;

            mockedUseDeleteProject.mockReturnValue({
                mutate: (projectId: string, options?: { onSuccess?: () => void }) => {
                    if (options) {
                        onSuccessCallback = options.onSuccess;
                    }
                    mockDeleteProject(projectId, options);
                },
                isLoading: false,
                isError: false,
                isSuccess: false,
                isIdle: true,
            } as unknown as ReturnType<typeof useDeleteProject>);

            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', { name: /delete this project/i });
            userEvent.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            userEvent.click(confirmButton);

            expect(mockDeleteProject).toHaveBeenCalledWith('test-project-id', expect.any(Object));

            // Simulate successful deletion
            if (onSuccessCallback) {
                onSuccessCallback();
            }

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Deleted project successfully', {
                variant: 'success',
            });
            expect(mockNavigate).toHaveBeenCalledWith('/projects');
        });

        it('should not delete project if projectId is undefined', () => {
            mockedUseParams.mockReturnValue({ projectId: undefined });

            render(<ProjectDangerZone />);

            const deleteButton = screen.getByRole('button', { name: /delete this project/i });
            userEvent.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            userEvent.click(confirmButton);

            expect(mockDeleteProject).not.toHaveBeenCalled();
        });
    });

    describe('Dev/Staging Clear Project Button', () => {
        it('should show clear project button in DEV environment on localhost', () => {
            import.meta.env.VITE_APP_ENV = 'DEV';
            render(<ProjectDangerZone />);

            expect(
                screen.getByRole('button', { name: /clear this project \(FOR DEV PURPOSES\)/i })
            ).toBeInTheDocument();
        });

        it('should show clear project button in STAGING environment on localhost', () => {
            import.meta.env.VITE_APP_ENV = 'STAGING';

            render(<ProjectDangerZone />);

            expect(
                screen.getByRole('button', { name: /clear this project \(FOR DEV PURPOSES\)/i })
            ).toBeInTheDocument();
        });

        it('should not show clear project button in PROD environment', () => {
            import.meta.env.VITE_APP_ENV = 'PROD';

            render(<ProjectDangerZone />);

            expect(
                screen.queryByRole('button', { name: /clear this project \(FOR DEV PURPOSES\)/i })
            ).not.toBeInTheDocument();
        });

        it('should not show clear project button when not on localhost', () => {
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { hostname: 'production.com' },
            });

            render(<ProjectDangerZone />);

            expect(
                screen.queryByRole('button', { name: /clear this project \(FOR DEV PURPOSES\)/i })
            ).not.toBeInTheDocument();
        });

        it('should delete studyset and clear provenance when clear button is clicked', () => {
            mockDeleteStudyset.mockResolvedValue(undefined);

            render(<ProjectDangerZone />);

            const clearButton = screen.getByRole('button', {
                name: /clear this project \(FOR DEV PURPOSES\)/i,
            });
            userEvent.click(clearButton);

            waitFor(() => {
                expect(mockDeleteStudyset).toHaveBeenCalledWith('test-studyset-id');
                expect(mockClearProvenance).toHaveBeenCalled();
            });
        });

        it('should only clear provenance when studysetId is undefined', () => {
            mockedUseProjectExtractionStudysetId.mockReturnValue(undefined);

            render(<ProjectDangerZone />);

            const clearButton = screen.getByRole('button', {
                name: /clear this project \(FOR DEV PURPOSES\)/i,
            });
            userEvent.click(clearButton);

            waitFor(() => {
                expect(mockDeleteStudyset).not.toHaveBeenCalled();
                expect(mockClearProvenance).toHaveBeenCalled();
            });
        });
    });

    describe('User Permissions', () => {
        it('should pass undefined to useUserCanEdit when projectUser is null', () => {
            mockedUseProjectUser.mockReturnValue(null);

            render(<ProjectDangerZone />);

            expect(useUserCanEdit).toHaveBeenCalledWith(undefined);
        });

        it('should pass projectUser to useUserCanEdit when available', () => {
            const projectUser = 'test-user-id';
            mockedUseProjectUser.mockReturnValue(projectUser);

            render(<ProjectDangerZone />);

            expect(useUserCanEdit).toHaveBeenCalledWith(projectUser);
        });
    });
});
