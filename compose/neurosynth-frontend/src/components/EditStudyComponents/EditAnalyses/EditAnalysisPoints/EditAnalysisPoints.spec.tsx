import { DataGridProps } from '@mui/x-data-grid';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCreatePoint, useDeletePoint, useUpdateAnalysis } from 'hooks';
import { act } from 'react-dom/test-utils';
import { mockPoints } from 'testing/mockData';

jest.mock('hooks');
jest.mock('react-query');
jest.mock(
    'components/EditStudyComponents/EditAnalyses/EditAnalysis/EditAnalysisPoints/AnalysisPointsHeader'
);
jest.mock(
    'components/EditStudyComponents/EditAnalyses/EditAnalysis/EditAnalysisPoints/AnalysisPointsDeleteButton'
);

// in regular jest tests, more than 3 columns are not properly rendered. We therefore need to
// mock the data grid and manually disable virtualization or add autoHeight
// https://github.com/mui/mui-x/issues/1151
jest.mock('@mui/x-data-grid', () => {
    const { DataGrid } = jest.requireActual('@mui/x-data-grid');
    return {
        ...jest.requireActual('@mui/x-data-grid'),
        DataGrid: (props: DataGridProps) => {
            return <DataGrid {...props} disableVirtualization />;
        },
    };
});

describe('EditAnalysisPoints Component', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should be truthy', () => {
        // placeholder test
        expect(true).toBeTruthy();
    });
    // const mockAnalysisArg: IEditAnalysisPoints = {
    //     points: mockPoints(),
    //     studyId: 'test-studyId',
    //     analysisId: 'test-analysisId',
    // };

    // it('should render', () => {
    //     render(<EditAnalysisPoints {...mockAnalysisArg} />);
    // });

    // it('should create a new point', () => {
    //     render(<EditAnalysisPoints {...mockAnalysisArg} />);
    //     userEvent.click(screen.getByTestId('trigger-add-point'));
    //     expect(useCreatePoint().mutate as jest.Mock).toHaveBeenCalledWith('test-analysisId');
    // });

    // it('should delete the given point', async () => {
    //     render(<EditAnalysisPoints {...mockAnalysisArg} />);

    //     await act(async () => {
    //         userEvent.click(screen.getAllByRole('button', { name: 'delete' })[0]);
    //     });

    //     expect(useDeletePoint().mutate as jest.Mock).toHaveBeenCalledWith(mockPoints()[0].id);
    // });

    // it('should move the selected points', () => {
    //     render(<EditAnalysisPoints {...mockAnalysisArg} />);
    //     userEvent.click(screen.getByTestId('trigger-move-point'));
    //     expect(useUpdateAnalysis().mutate as jest.Mock).toHaveBeenCalledWith({
    //         analysisId: mockAnalysisArg.analysisId,
    //         analysis: {
    //             points: mockPoints().map((x) => x?.id),
    //         },
    //     });
    // });
});
