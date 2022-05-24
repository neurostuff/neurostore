import { useGridApiContext } from '@mui/x-data-grid';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisReturn, PointReturn } from 'neurostore-typescript-sdk';
import { mockStudy } from 'testing/mockData';
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

    beforeEach(() => {
        (useGridApiContext().current.getSelectedRows as jest.Mock).mockReturnValue({
            size: 1,
            keys: jest.fn().mockReturnValue(['mock-id-1']),
        });
    });

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
        it('should be hidden initially', () => {
            (useGridApiContext().current.getSelectedRows as jest.Mock).mockReturnValue({
                size: 0,
                keys: jest.fn().mockReturnValue([]),
            });

            render(
                <AnalysisPointsHeader
                    studyId="test-studyId"
                    analysisId="test-analysisId"
                    onCreatePoint={mockOnCreatePoint}
                    onMovePoints={mockOnMovePoints}
                />
            );

            expect(screen.getAllByRole('button').length).toEqual(1);
        });

        it('should be shown', () => {
            render(
                <AnalysisPointsHeader
                    studyId="test-studyId"
                    analysisId="test-analysisId"
                    onCreatePoint={mockOnCreatePoint}
                    onMovePoints={mockOnMovePoints}
                />
            );

            expect(screen.getAllByRole('button').length).toEqual(2);
            expect(screen.getByText('Move 1 point(s) to another analysis')).toBeInTheDocument();
        });

        it('should show the analyses options', () => {
            render(
                <AnalysisPointsHeader
                    studyId="test-studyId"
                    analysisId="test-analysisId"
                    onCreatePoint={mockOnCreatePoint}
                    onMovePoints={mockOnMovePoints}
                />
            );

            userEvent.click(
                screen.getByRole('button', { name: 'Move 1 point(s) to another analysis' })
            );

            const analysesOptions = screen.getAllByRole('menuitem');
            expect(analysesOptions.length).toEqual(mockStudy().analyses?.length);
        });

        it('should call the function and move the points', () => {
            render(
                <AnalysisPointsHeader
                    studyId="test-studyId"
                    analysisId="test-analysisId"
                    onCreatePoint={mockOnCreatePoint}
                    onMovePoints={mockOnMovePoints}
                />
            );

            userEvent.click(
                screen.getByRole('button', { name: 'Move 1 point(s) to another analysis' })
            );

            userEvent.click(screen.getAllByRole('menuitem')[0]);

            const expectedAnalysisId = (mockStudy().analyses as AnalysisReturn[])[0].id;
            const existingPoints = (
                (mockStudy().analyses as AnalysisReturn[])[0].points as PointReturn[]
            ).map((x) => x?.id || '');

            expect(mockOnMovePoints).toHaveBeenCalledWith(expectedAnalysisId, [
                ...existingPoints,
                'mock-id-1',
            ]);
        });
    });
});
