import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetBaseStudyInfoById, useGetStudyNonNestedById, useUpdateStudyset } from 'hooks';
import { EAnalysisType } from 'hooks/projects/Project.types';
import {
    useProjectAnalysisType,
    useProjectExtractionReplaceStudyListStatusId,
} from 'stores/projects/ProjectStore';
import EditStudySwapVersionButtonNext from 'pages/StudyIBMA/components/EditStudySwapVersionButtonNext';
import { useNavigate, useParams } from 'react-router-dom';
import { mockBaseStudy, mockStudy, mockStudysetNotNested } from 'testing/mockData';

vi.mock('react-router-dom');
vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');
vi.mock('components/Dialogs/ConfirmationDialog');
vi.mock('notistack');
vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>();
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
        }),
    };
});
vi.mock('hooks/annotations/annotationQueries', () => ({
    default: {
        byId: () => ({ queryKey: ['annotation', 'annotation-id'] }),
    },
}));

const openSwapMenu = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Swap study version' }));
};

const imageVersion = {
    id: 'image-version',
    username: 'image-user',
    updated_at: '2024-07-01T00:00:00.000Z',
    has_coordinates: false,
    has_images: true,
};

const coordinateVersion = {
    id: 'coord-version',
    username: 'coord-user',
    updated_at: '2024-06-01T00:00:00.000Z',
    has_coordinates: true,
    has_images: false,
};

describe('EditStudySwapVersionButtonNext Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const studyset = mockStudysetNotNested();
        const currentStudyId = studyset.studies?.[0] as string;

        (useParams as Mock).mockReturnValue({ projectId: 'project-id', studyId: currentStudyId });
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.IBMA);
        (useGetStudyNonNestedById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: mockStudy({ id: currentStudyId, base_study: 'base-study-id' }),
        });
        (useGetBaseStudyInfoById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                ...mockBaseStudy(),
                id: 'base-study-id',
                versions: [
                    {
                        id: currentStudyId,
                        username: 'neurosynth',
                        updated_at: '2024-05-01T00:00:00.000Z',
                        has_coordinates: false,
                        has_images: true,
                    },
                    imageVersion,
                    coordinateVersion,
                ],
            },
        });
    });

    it('should render', () => {
        render(<EditStudySwapVersionButtonNext />);
    });

    it('should open the menu when clicked', async () => {
        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should show type labels for each version', async () => {
        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        expect(screen.getAllByText('Images').length).toBeGreaterThan(0);
        expect(screen.getByText('Coordinates')).toBeInTheDocument();
    });

    it('should show "Current" representing the current version in the studyset', async () => {
        const studyset = mockStudysetNotNested();
        const currentStudyId = studyset.studies?.[0] as string;

        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        expect(screen.getByText('Current')).toBeInTheDocument();
        expect(screen.getByTestId(`swap-to-version-${currentStudyId}`)).toHaveTextContent('Current');
        expect(screen.getByTestId('swap-to-version-image-version')).not.toHaveTextContent('Current');
        expect(screen.getByTestId('swap-to-version-coord-version')).not.toHaveTextContent('Current');
    });

    it('should keep view links available for incompatible versions', async () => {
        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        const viewLinks = screen.getAllByRole('link', { name: /View version/i });
        expect(viewLinks.length).toBe(3);
        expect(viewLinks.some((link) => link.getAttribute('href')?.includes('coord-version'))).toBe(true);
    });

    it('should switch to a compatible image-based version', async () => {
        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        await userEvent.click(screen.getByTestId('swap-to-version-image-version'));
        expect(screen.getByText('Are you sure you want to switch the study version?')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('accept-close-confirmation'));

        expect(useUpdateStudyset().mutateAsync).toHaveBeenCalled();
        expect(useProjectExtractionReplaceStudyListStatusId()).toHaveBeenCalled();
        expect(useNavigate()).toHaveBeenCalledWith(
            '/projects/project-id/extraction/studies/image-version/edit'
        );
    });

    it('should not switch to non-image versions in IBMA projects', async () => {
        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        const coordinateMenuItem = screen.getByTestId('swap-to-version-coord-version');
        expect(coordinateMenuItem).toHaveAttribute('aria-disabled', 'true');

        await userEvent.click(coordinateMenuItem);
        expect(screen.queryByText('Are you sure you want to switch the study version?')).not.toBeInTheDocument();
    });

    it('should disable image versions when the project is CBMA', async () => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.CBMA);

        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        expect(screen.getByTestId('swap-to-version-image-version')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByTestId('swap-to-version-coord-version')).toHaveAttribute('aria-disabled', 'false');
    });

    it('should disable coordinate versions when the project is IBMA', async () => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.IBMA);

        render(<EditStudySwapVersionButtonNext />);
        await openSwapMenu();

        expect(screen.getByTestId('swap-to-version-coord-version')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByTestId('swap-to-version-image-version')).toHaveAttribute('aria-disabled', 'false');
    });
});
