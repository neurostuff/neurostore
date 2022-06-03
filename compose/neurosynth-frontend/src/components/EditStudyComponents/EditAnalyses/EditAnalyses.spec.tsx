import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAnalyses } from 'testing/mockData';
import { AnalysisApiResponse } from 'utils/api';
import EditAnalyses from './EditAnalyses';

// already tested child component
jest.mock('components/EditStudyComponents/EditAnalyses/EditAnalysis/EditAnalysis');
jest.mock('components/Dialogs/ConfirmationDialog/ConfirmationDialog');
jest.mock('utils/api');
jest.mock('hooks');

describe('EditAnalyses Component', () => {
    let analyses: AnalysisApiResponse[] = [];
    let renderResult: RenderResult;

    beforeEach(() => {
        analyses = mockAnalyses();
        renderResult = render(<EditAnalyses analyses={analyses} />);
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const title = screen.getByText('Edit Analyses');
        expect(title).toBeInTheDocument();
    });

    it('should show a no analyses message if there are no analyses', () => {
        renderResult.rerender(<EditAnalyses analyses={[]} />);

        expect(screen.getByText('No analyses for this study')).toBeInTheDocument();
    });

    it('should show the correct number of tabs for the given analyses', () => {
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toEqual(analyses.length);
    });

    it('should default to the first tab being selected', () => {
        // can use aria-selected
        const firstTab = screen.getAllByRole('tab')[0];
        expect(firstTab).toHaveClass('Mui-selected');
    });

    it('should change the tab correctly', () => {
        const secondTab = screen.getAllByRole('tab')[1];
        userEvent.click(secondTab);

        expect(screen.getByTestId('mock-edit-analysis-name').innerHTML).toEqual(analyses[1].name);
    });
});
