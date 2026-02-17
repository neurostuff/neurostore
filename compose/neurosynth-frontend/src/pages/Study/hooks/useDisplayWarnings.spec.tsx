import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    useStudyAnalyses,
    useStudyAnalysisName,
    useStudyAnalysisPoints,
} from 'pages/Study/store/StudyStore';
import { mockAnalyses, mockStorePoints } from 'testing/mockData';
import useDisplayWarnings, { isCoordinateMNI } from './useDisplayWarnings';

vi.mock('pages/Study/store/StudyStore', () => ({
    useStudyAnalysisPoints: vi.fn(),
    useStudyAnalysisName: vi.fn(),
    useStudyAnalyses: vi.fn(),
}));

const DummyComponent = ({ analysisId }: { analysisId?: string }) => {
    const warnings = useDisplayWarnings(analysisId);
    return (
        <div>
            <span data-testid="has-no-points">{String(warnings.hasNoPoints)}</span>
            <span data-testid="has-no-name">{String(warnings.hasNoName)}</span>
            <span data-testid="has-duplicate-name">{String(warnings.hasDuplicateName)}</span>
            <span data-testid="has-non-mni-coordinates">{String(warnings.hasNonMNICoordinates)}</span>
        </div>
    );
};

describe('isCoordinateMNI', () => {
    it('returns true for coordinates within MNI bounds', () => {
        expect(isCoordinateMNI(0, 0, 0)).toBe(true);
        expect(isCoordinateMNI(12, -18, 22)).toBe(true);
        expect(isCoordinateMNI(-40, -68, -20)).toBe(true);
        expect(isCoordinateMNI(90, 90, 108)).toBe(true);
        expect(isCoordinateMNI(-90, -126, -72)).toBe(true);
    });

    it('returns false for x outside bounds', () => {
        expect(isCoordinateMNI(91, 0, 0)).toBe(false);
        expect(isCoordinateMNI(-91, 0, 0)).toBe(false);
    });

    it('returns false for y outside bounds', () => {
        expect(isCoordinateMNI(0, 91, 0)).toBe(false);
        expect(isCoordinateMNI(0, -127, 0)).toBe(false);
    });

    it('returns false for z outside bounds', () => {
        expect(isCoordinateMNI(0, 0, 109)).toBe(false);
        expect(isCoordinateMNI(0, 0, -73)).toBe(false);
    });
});

describe('useDisplayWarnings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const analyses = mockAnalyses();
        analyses[0].points = mockStorePoints() as never;
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());
        (useStudyAnalysisName as Mock).mockReturnValue('Analysis 1');
        (useStudyAnalyses as Mock).mockReturnValue(analyses);
    });

    it('renders without crashing', () => {
        render(<DummyComponent />);
    });

    it('returns hasNoPoints true when points array is empty', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-no-points')).toHaveTextContent('true');
    });

    it('returns hasNoPoints true when points is null', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(null);
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-no-points')).toHaveTextContent('true');
    });

    it('returns hasNoPoints false when points has items', () => {
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-no-points')).toHaveTextContent('false');
    });

    it('returns hasNoName true when name is empty', () => {
        (useStudyAnalysisName as Mock).mockReturnValue('');
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-no-name')).toHaveTextContent('true');
    });

    it('returns hasNoName false when name is provided', () => {
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-no-name')).toHaveTextContent('false');
    });

    it('returns hasDuplicateName true when another analysis has the same name', () => {
        const analyses = mockAnalyses();
        analyses[0].points = mockStorePoints() as never;
        analyses[0].name = 'Same Name';
        analyses[0].id = 'analysis-1';
        analyses[1].name = 'Same Name';
        analyses[1].id = 'analysis-2';
        (useStudyAnalyses as Mock).mockReturnValue(analyses);
        (useStudyAnalysisName as Mock).mockReturnValue('Same Name');
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());

        render(<DummyComponent analysisId="analysis-1" />);
        expect(screen.getByTestId('has-duplicate-name')).toHaveTextContent('true');
    });

    it('returns hasDuplicateName false when no other analysis has the same name', () => {
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-duplicate-name')).toHaveTextContent('false');
    });

    it('excludes current analysis when checking for duplicate names', () => {
        const analyses = mockAnalyses();
        analyses[0].points = mockStorePoints() as never;
        analyses[0].name = 'Unique Name';
        analyses[0].id = 'analysis-1';
        (useStudyAnalyses as Mock).mockReturnValue(analyses);
        (useStudyAnalysisName as Mock).mockReturnValue('Unique Name');
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());

        render(<DummyComponent analysisId="analysis-1" />);
        expect(screen.getByTestId('has-duplicate-name')).toHaveTextContent('false');
    });

    it('returns hasNonMNICoordinates true when a point is outside MNI bounds', () => {
        const pointsOutsideMNI = [
            { ...mockStorePoints()[0], x: 100, y: 0, z: 0 },
            mockStorePoints()[1],
        ];
        (useStudyAnalysisPoints as Mock).mockReturnValue(pointsOutsideMNI);

        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-non-mni-coordinates')).toHaveTextContent('true');
    });

    it('returns hasNonMNICoordinates false when all points are within MNI bounds', () => {
        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-non-mni-coordinates')).toHaveTextContent('false');
    });

    it('treats undefined coordinates as 0 when checking MNI bounds', () => {
        const pointsWithUndefined = [{ x: undefined, y: undefined, z: undefined }];
        (useStudyAnalysisPoints as Mock).mockReturnValue(pointsWithUndefined);

        render(<DummyComponent analysisId="3MXg8tfRq2sh" />);
        expect(screen.getByTestId('has-non-mni-coordinates')).toHaveTextContent('false');
    });

    it('passes analysisId to store hooks', () => {
        render(<DummyComponent analysisId="test-analysis-id" />);
        expect(useStudyAnalysisPoints).toHaveBeenCalledWith('test-analysis-id');
        expect(useStudyAnalysisName).toHaveBeenCalledWith('test-analysis-id');
    });
});
