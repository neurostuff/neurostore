import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import CurationBoardAIInterfaceCuratorTableHints from './CurationBoardAIInterfaceCuratorTableHints';
import {
    useProjectCurationColumn,
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
} from 'pages/Project/store/ProjectStore';

vi.mock('hooks', () => ({
    useGetCurationSummary: vi.fn().mockReturnValue({ included: 0, uncategorized: 0, excluded: 0 }),
}));
vi.mock('pages/Project/store/ProjectStore');
vi.mock('react-router-dom');
vi.mock('pages/Curation/context/CurationBoardGroupsContext', () => ({
    useCurationBoardGroups: vi.fn().mockReturnValue({
        handleSelectPreviousGroup: vi.fn(),
        handleSelectNextGroup: vi.fn(),
        selectedGroup: undefined,
    }),
}));
vi.mock('pages/CurationImport/components/ImportStudiesButton', () => ({
    default: vi.fn().mockImplementation(() => <button>Import Studies</button>),
}));
vi.mock('pages/Curation/components/StartExtractionButton', () => ({
    default: vi.fn().mockImplementation(() => <button>Start Extraction</button>),
}));

import { useGetCurationSummary } from 'hooks';
import { useParams } from 'react-router-dom';

const mockEmptyColumn = { stubStudies: [] };
const mockColumnWithStudies = {
    stubStudies: [
        { exclusionTag: null, title: 'study 1' },
        { exclusionTag: 'duplicate', title: 'study 2' },
    ],
};
const mockAllExcluded = {
    stubStudies: [{ exclusionTag: 'duplicate', title: 'study 1' }],
};

describe('CurationBoardAIInterfaceCuratorTableHints', () => {
    beforeEach(() => {
        (useProjectCurationColumns as Mock).mockReturnValue([mockEmptyColumn]);
        (useProjectCurationIsPrisma as Mock).mockReturnValue(false);
        (useProjectCurationColumn as Mock).mockReturnValue(mockEmptyColumn);
        (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 0, excluded: 0 });

        (useParams as Mock).mockReturnValue({ projectId: 'test-project-id' });
    });

    describe('when there are no studies at all (noStudiesInCuration)', () => {
        it('should show the "To get started, search" card', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />);
            expect(screen.getByText(/To get started,/i)).toBeInTheDocument();
        });

        it('should show the import card with import button', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />);
            expect(screen.getByText('Import Studies')).toBeInTheDocument();
        });
    });

    describe('when there are visible studies', () => {
        it('should return null (render nothing)', () => {
            (useProjectCurationColumn as Mock).mockReturnValue(mockColumnWithStudies);
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 2, excluded: 0 });
            const { container } = render(
                <CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={2} columnIndex={0} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('non-PRISMA workflow', () => {
        beforeEach(() => {
            (useProjectCurationIsPrisma as Mock).mockReturnValue(false);
            (useProjectCurationColumn as Mock).mockReturnValue(mockAllExcluded);
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 0, excluded: 1 });
        });

        it('should show "No included studies" text for the included phase', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={1} />);
            expect(screen.getByText(/No included studies/i)).toBeInTheDocument();
        });

        it('should show completion message when curation is complete', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            (useProjectCurationColumn as Mock).mockReturnValue(mockEmptyColumn);
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />);
            expect(screen.getByText(/You've reviewed all the uncategorized studies!/i)).toBeInTheDocument();
        });

        it('should show the Start Extraction button when curation is complete', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            (useProjectCurationColumn as Mock).mockReturnValue(mockEmptyColumn);
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />);
            expect(screen.getByText('Start Extraction')).toBeInTheDocument();
        });
    });

    describe('PRISMA workflow', () => {
        beforeEach(() => {
            (useProjectCurationIsPrisma as Mock).mockReturnValue(true);
            (useProjectCurationColumn as Mock).mockReturnValue(mockAllExcluded);
            (useGetCurationSummary as Mock).mockReturnValue({ included: 0, uncategorized: 5, excluded: 1 });
        });

        it('should show identification phase text when columnIndex is 0', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />);
            expect(screen.getByText(/No studies to review for identification/i)).toBeInTheDocument();
        });

        it('should show screening phase text when columnIndex is 1', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={1} />);
            expect(screen.getByText(/No studies to review for screening/i)).toBeInTheDocument();
        });

        it('should show eligibility phase text when columnIndex is 2', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={2} />);
            expect(screen.getByText(/No studies to review for eligibility/i)).toBeInTheDocument();
        });

        it('should show "No included studies" for the included phase', () => {
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={3} />);
            expect(screen.getByText(/No included studies/i)).toBeInTheDocument();
        });

        it('should show reviewed-all message when curation is complete in screening phase', () => {
            (useGetCurationSummary as Mock).mockReturnValue({ included: 5, uncategorized: 0, excluded: 0 });
            (useProjectCurationColumn as Mock).mockReturnValue(mockEmptyColumn);
            render(<CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={1} />);
            expect(screen.getByText(/You've reviewed all the uncategorized studies in screening/i)).toBeInTheDocument();
        });
    });
});
