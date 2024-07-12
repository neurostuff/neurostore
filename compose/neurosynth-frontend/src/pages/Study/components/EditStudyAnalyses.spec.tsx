import { RenderResult } from '@testing-library/react';
import { AnalysisReturn } from 'neurostore-typescript-sdk';

describe('EditStudyAnalyses Component', () => {
    let analyses: AnalysisReturn[] = [];
    let renderResult: RenderResult;

    it('should be truthy', () => {
        // placeholder test
        expect(true).toBeTruthy();
    });

    // beforeEach(() => {
    //     analyses = mockAnalyses();
    //     renderResult = render(<EditAnalyses studyId="test-id" analyses={analyses} />);
    // });

    // afterAll(() => {
    //     jest.clearAllMocks();
    // });

    // it('should render', () => {
    //     const title = screen.getByText('Edit Analyses');
    //     expect(title).toBeInTheDocument();
    // });

    // it('should show a no analyses message if there are no analyses', () => {
    //     renderResult.rerender(<EditAnalyses studyId="test-id" analyses={[]} />);

    //     expect(screen.getByText('No analyses for this study')).toBeInTheDocument();
    // });

    // it('should create an analysis', () => {
    //     const createAnalysisButton = screen.getByRole('button', { name: 'new analysis' });
    //     userEvent.click(createAnalysisButton);

    //     userEvent.click(screen.getByTestId('mock-create-button'));

    //     expect(useCreateAnalysis().mutate).toHaveBeenCalledWith({
    //         name: 'test name',
    //         description: 'test description',
    //         study: 'test-id',
    //     });
    // });

    // describe('tabs', () => {
    //     it('should show the correct number of tabs for the given analyses', () => {
    //         const tabs = screen.getAllByRole('tab');
    //         expect(tabs.length).toEqual(analyses.length);
    //     });

    //     it('should default to the first tab being selected', () => {
    //         const firstTab = screen.getAllByRole('tab')[0];
    //         expect(firstTab).toHaveClass('Mui-selected');
    //     });

    //     it('should change the tab correctly', () => {
    //         const secondTab = screen.getAllByRole('tab')[1];
    //         userEvent.click(secondTab);

    //         expect(screen.getByTestId('mock-edit-analysis-name').innerHTML).toEqual(
    //             analyses[1].name
    //         );
    //     });
    // });
});
