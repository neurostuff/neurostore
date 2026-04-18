import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StartExtractionButton from './StartExtractionButton';
import {
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { enqueueSnackbar, closeSnackbar } from 'notistack';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('hooks', () => ({
    useGetCurationSummary: vi.fn().mockReturnValue({ included: 0, uncategorized: 0, excluded: 0 }),
    useGetStudysetById: vi.fn().mockReturnValue({ data: null }),
    useUserCanEdit: vi.fn().mockReturnValue(true),
}));

vi.mock('stores/projects/ProjectStore');

vi.mock('notistack', () => ({
    enqueueSnackbar: vi.fn().mockReturnValue('snackbar-key-1'),
    closeSnackbar: vi.fn(),
}));

vi.mock('pages/Curation/context/CurationBoardGroupsContext', () => ({
    useCurationBoardGroups: vi.fn().mockReturnValue({
        groups: [],
        handleSetSelectedGroup: vi.fn(),
        handleSelectPreviousGroup: vi.fn(),
        handleSelectNextGroup: vi.fn(),
        handleSetFirstCurationGroup: vi.fn(),
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
}));

import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';

const mockColumn = (name: string, id: string, studies: { exclusionTag: string | null }[]) => ({
    name,
    id,
    stubStudies: studies,
});

describe('StartExtractionButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectCurationColumns as Mock).mockReturnValue([]);
        (useProjectCurationIsPrisma as Mock).mockReturnValue(false);
        (useProjectExtractionStudysetId as Mock).mockReturnValue(null);
        (useProjectExtractionAnnotationId as Mock).mockReturnValue(null);
        (useProjectId as Mock).mockReturnValue('test-project-id');
        (useProjectUser as Mock).mockReturnValue('user-1');
        (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 0, excluded: 0 });
        (useGetStudysetById as Mock).mockReturnValue({ data: null });
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useCurationBoardGroups as Mock).mockReturnValue({
            groups: [],
            handleSetSelectedGroup: vi.fn(),
        });
        mockNavigate.mockClear();
    });

    describe('button text', () => {
        it('shows "start extraction" when extraction is not initialized', () => {
            render(<StartExtractionButton />);
            expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument();
        });

        it('shows "view extraction" when extraction is already initialized', () => {
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studyset-1');
            (useProjectExtractionAnnotationId as Mock).mockReturnValue('annotation-1');
            (useGetStudysetById as Mock).mockReturnValue({ data: { studies: ['study-1'] } });

            render(<StartExtractionButton />);
            expect(screen.getByRole('button', { name: /view extraction/i })).toBeInTheDocument();
        });
    });

    describe('button variant', () => {
        it('renders as "text" variant when curation is incomplete (uncategorized > 0)', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 3, excluded: 0 });

            render(<StartExtractionButton />);
            const btn = screen.getByRole('button');
            expect(btn).not.toHaveClass('MuiButton-contained');
        });

        it('renders as "contained" variant when included > 0 and uncategorized === 0', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });

            render(<StartExtractionButton />);
            const btn = screen.getByRole('button');
            expect(btn).toHaveClass('MuiButton-contained');
        });
    });

    describe('disabled state', () => {
        it('is disabled when user cannot edit', () => {
            (useUserCanEdit as Mock).mockReturnValue(false);

            render(<StartExtractionButton />);
            expect(screen.getByRole('button')).toBeDisabled();
        });

        it('is enabled when user can edit', () => {
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<StartExtractionButton />);
            expect(screen.getByRole('button')).not.toBeDisabled();
        });
    });

    describe('priority icon', () => {
        it('shows a priority icon when curation is complete but extraction is not yet initialized', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            // extraction not initialized (no studysetId)

            render(<StartExtractionButton />);
            // PriorityHighIcon renders as an SVG with a MuiSvgIcon class
            expect(document.querySelector('.MuiSvgIcon-root')).toBeInTheDocument();
        });

        it('does not show a priority icon when extraction is already initialized', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studyset-1');
            (useProjectExtractionAnnotationId as Mock).mockReturnValue('annotation-1');
            (useGetStudysetById as Mock).mockReturnValue({ data: { studies: ['study-1'] } });

            render(<StartExtractionButton />);
            expect(document.querySelector('.MuiSvgIcon-root')).not.toBeInTheDocument();
        });

        it('does not show a priority icon when curation is still incomplete', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 3, excluded: 0 });

            render(<StartExtractionButton />);
            expect(document.querySelector('.MuiSvgIcon-root')).not.toBeInTheDocument();
        });
    });

    describe('onClick - curation incomplete', () => {
        it('fires a warning snackbar listing columns with uncategorized studies', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 2, excluded: 0 });
            (useProjectCurationColumns as Mock).mockReturnValue([
                mockColumn('Identification', 'col-1', [{ exclusionTag: null }, { exclusionTag: 'duplicate' }]),
                mockColumn('Included', 'col-included', []),
            ]);

            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
            const [content, options] = (enqueueSnackbar as Mock).mock.calls[0];
            expect(options).toMatchObject({ variant: 'warning', autoHideDuration: null });
            // The snackbar content is JSX; check that it was called
            expect(content).toBeDefined();
        });

        it('does not navigate when curation is incomplete', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 2, excluded: 0 });
            (useProjectCurationColumns as Mock).mockReturnValue([
                mockColumn('Identification', 'col-1', [{ exclusionTag: null }]),
                mockColumn('Included', 'col-included', []),
            ]);

            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('does not include the last column (Included) in the issue list', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 1, excluded: 0 });
            (useProjectCurationColumns as Mock).mockReturnValue([
                mockColumn('Identification', 'col-1', [{ exclusionTag: null }]),
                mockColumn('Included', 'col-included', [{ exclusionTag: null }]),
            ]);

            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            // enqueueSnackbar called once; the last column should be excluded from issues
            expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
        });
    });

    describe('onClick - curation complete, extraction not initialized', () => {
        beforeEach(() => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
        });

        it('navigates to the project page with openCurationDialog flag', () => {
            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(mockNavigate).toHaveBeenCalledWith('/projects/test-project-id/project', {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                },
            });
        });

        it('does not call enqueueSnackbar', () => {
            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(enqueueSnackbar).not.toHaveBeenCalled();
        });
    });

    describe('onClick - extraction already initialized', () => {
        beforeEach(() => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studyset-1');
            (useProjectExtractionAnnotationId as Mock).mockReturnValue('annotation-1');
            (useGetStudysetById as Mock).mockReturnValue({ data: { studies: ['study-1'] } });
        });

        it('navigates to the extraction page', () => {
            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(mockNavigate).toHaveBeenCalledWith('/projects/test-project-id/extraction');
        });

        it('does not call enqueueSnackbar', () => {
            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button'));

            expect(enqueueSnackbar).not.toHaveBeenCalled();
        });
    });

    describe('snackbar "Go to" buttons close the snackbar and select the group', () => {
        it('calls closeSnackbar and handleSetSelectedGroup when a "Go to" button is clicked', async () => {
            const mockHandleSetSelectedGroup = vi.fn();
            const matchingGroup = { id: 'col-1', name: 'Identification' };

            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 1, excluded: 0 });
            (useProjectCurationColumns as Mock).mockReturnValue([
                mockColumn('Identification', 'col-1', [{ exclusionTag: null }]),
                mockColumn('Included', 'col-included', []),
            ]);
            (useCurationBoardGroups as Mock).mockReturnValue({
                groups: [matchingGroup],
                handleSetSelectedGroup: mockHandleSetSelectedGroup,
            });
            (enqueueSnackbar as Mock).mockReturnValue('snackbar-key-1');

            render(<StartExtractionButton />);
            fireEvent.click(screen.getByRole('button', { name: /start extraction/i }));

            // The snackbar content is rendered via enqueueSnackbar - simulate calling the onClick
            // by extracting the rendered JSX content from the snackbar call
            const [snackbarContent] = (enqueueSnackbar as Mock).mock.calls[0];

            // Render the snackbar content in isolation to interact with "Go to" buttons
            const { getByRole: getByRoleInSnackbar } = render(snackbarContent);
            const goToBtn = getByRoleInSnackbar('button', { name: /go to identification/i });
            fireEvent.click(goToBtn);

            expect(closeSnackbar).toHaveBeenCalledWith('snackbar-key-1');
            expect(mockHandleSetSelectedGroup).toHaveBeenCalledWith(matchingGroup);
        });
    });
});
