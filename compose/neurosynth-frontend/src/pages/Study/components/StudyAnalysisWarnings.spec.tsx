import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudyAnalysisWarnings from 'pages/Study/components/StudyAnalysisWarnings';
import { useStudyAnalysisWarnings } from 'stores/study/StudyStore';

vi.mock('stores/study/StudyStore');

const NON_MNI_TEXT = 'This analysis may contain non MNI coordinates';
const INVALID_ENTRIES_TEXT = 'This analysis has invalid entries';
const EMPTY_COORDINATES_TEXT = 'This analysis has empty coordinates';

describe('StudyAnalysisWarnings', () => {
    beforeEach(() => {
        useStudyAnalysisWarnings().hasEmptyPoints = false;
        useStudyAnalysisWarnings().hasNonMNICoordinates = false;
        useStudyAnalysisWarnings().hasInvalidEntries = false;
    });

    it('shows the stored point warnings', () => {
        useStudyAnalysisWarnings().hasNonMNICoordinates = true;
        useStudyAnalysisWarnings().hasInvalidEntries = true;
        render(<StudyAnalysisWarnings analysisId="analysis-1" />);

        expect(screen.getByText(NON_MNI_TEXT)).toBeInTheDocument();
        expect(screen.getByText(INVALID_ENTRIES_TEXT)).toBeInTheDocument();
    });

    it('shows the empty coordinates warning', () => {
        useStudyAnalysisWarnings().hasEmptyPoints = true;
        render(<StudyAnalysisWarnings analysisId="analysis-1" />);

        expect(screen.getByText(EMPTY_COORDINATES_TEXT)).toBeInTheDocument();
        expect(screen.queryByText(NON_MNI_TEXT)).not.toBeInTheDocument();
    });
});
