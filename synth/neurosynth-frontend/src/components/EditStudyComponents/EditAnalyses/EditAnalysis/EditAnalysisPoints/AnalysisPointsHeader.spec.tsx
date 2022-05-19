import { render } from '@testing-library/react';
import AnalysisPointsHeader from './AnalysisPointsHeader';

jest.mock('hooks');
jest.mock('@mui/x-data-grid', () => ({
    useGridApiContext: jest.fn().mockReturnValue({
        current: {
            getSelectedRows: jest.fn().mockReturnValue({
                size: 1,
                keys: jest.fn().mockReturnValue(['mock-id-1']),
            }),
        },
    }),
}));

describe('AnalysisPointsHeader Component', () => {
    const mockOnCreatePoint = jest.fn();
    const mockOnMovePoints = jest.fn();

    it('should render', () => {
        render(
            <AnalysisPointsHeader
                studyId="test-studyId"
                analysisId="test-analysisId"
                onCreatePoint={mockOnCreatePoint}
                onMovePoints={mockOnMovePoints}
            />
        );
    });

    it('should call the function when the new point button is clicked', () => {
        render(
            <AnalysisPointsHeader
                studyId="test-studyId"
                analysisId="test-analysisId"
                onCreatePoint={mockOnCreatePoint}
                onMovePoints={mockOnMovePoints}
            />
        );
    });

    describe('move points button', () => {
        it('should be hidden initially', () => {});

        it('should be shown', () => {});

        it('should show the analyses options', () => {});

        it('should call the function and move the points', () => {});
    });
});
