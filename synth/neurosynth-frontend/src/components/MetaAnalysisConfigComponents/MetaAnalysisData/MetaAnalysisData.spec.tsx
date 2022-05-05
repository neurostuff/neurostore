import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { mockAnnotations, mockStudysets } from '../../../testing/mockData';
import MetaAnalysisData from './MetaAnalysisData';

jest.mock('../../NeurosynthAutocomplete/NeurosynthAutocomplete');
jest.mock('../../Buttons/NavigationButtons/NavigationButtons');
jest.mock('../../../utils/api');

describe('MetaAnalysisData component', () => {
    const mockOnUpdate = jest.fn();
    const mockOnNext = jest.fn();
    const queryClient = new QueryClient();
    let rerenderObj: (
        ui: React.ReactElement<any, string | React.JSXElementConstructor<any>>
    ) => void;

    beforeEach(() => {
        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <MetaAnalysisData
                    metaAnalysisType={undefined}
                    studyset={undefined}
                    annotation={undefined}
                    inclusionColumn={undefined}
                    onUpdate={mockOnUpdate}
                    onNext={mockOnNext}
                />
            </QueryClientProvider>
        );
        rerenderObj = rerender;
    });

    it('should render', () => {});

    describe('navigation buttons', () => {
        it('should call onNext with next', () => {
            userEvent.click(screen.getByTestId('next-button'));
            expect(mockOnNext).toHaveBeenCalledWith('NEXT');
        });

        it('should call onNext with previous', () => {
            userEvent.click(screen.getByTestId('prev-button'));
            expect(mockOnNext).toHaveBeenCalledWith('PREV');
        });
    });

    it('should show an error when no data is selected', () => {
        // open up input
        const selectInput = screen.getByLabelText('analysis type');
        userEvent.click(selectInput);

        // escape to close the dropdown, and tab to focus out
        userEvent.type(selectInput, '{esc}');
        userEvent.tab();

        expect(screen.getByText('this is required')).toBeInTheDocument();
    });

    describe('onUpdate', () => {
        it('should be called when updating the analysis type', () => {
            // open up input
            const selectInput = screen.getByLabelText('analysis type');
            userEvent.click(selectInput);

            // open up dropdown
            const cbmaOption = screen.getByText('Coordinate Based Meta-Analysis');
            userEvent.click(cbmaOption);

            expect(mockOnUpdate).toHaveBeenCalledWith({
                analysisType: 'CBMA',
            });
        });

        it('should be called when updating the studyset', () => {
            const myMockStudysets = mockStudysets();

            const mockStudysetOption = screen.getByText(myMockStudysets[0].name || '');
            userEvent.click(mockStudysetOption);

            expect(mockOnUpdate).toHaveBeenCalledWith({
                studyset: myMockStudysets[0],
                annotation: null,
                inclusionColumn: null,
            });
        });

        it('should be called when updating the annotation', async () => {
            const myMockStudysets = mockStudysets();
            const myMockAnnotations = mockAnnotations();

            rerenderObj(
                <QueryClientProvider client={queryClient}>
                    <MetaAnalysisData
                        metaAnalysisType={EAnalysisType.CBMA}
                        studyset={myMockStudysets[0]}
                        annotation={undefined}
                        inclusionColumn={undefined}
                        onUpdate={mockOnUpdate}
                        onNext={mockOnNext}
                    />
                </QueryClientProvider>
            );

            const mockAnnotationOption = await screen.findByText(myMockAnnotations[0].name || '');
            userEvent.click(mockAnnotationOption);

            expect(mockOnUpdate).toHaveBeenCalledWith({
                annotation: myMockAnnotations[0],
                inclusionColumn: null,
            });
        });

        it('should be called when updating the inclusion column', async () => {
            const myMockStudysets = mockStudysets();
            const myMockAnnotations = mockAnnotations();

            rerenderObj(
                <QueryClientProvider client={queryClient}>
                    <MetaAnalysisData
                        metaAnalysisType={EAnalysisType.CBMA}
                        studyset={myMockStudysets[0]}
                        annotation={myMockAnnotations[0]}
                        inclusionColumn={undefined}
                        onUpdate={mockOnUpdate}
                        onNext={mockOnNext}
                    />
                </QueryClientProvider>
            );

            const inclusionColumnOption = await screen.findByText('inclusion_col');
            userEvent.click(inclusionColumnOption);

            expect(mockOnUpdate).toHaveBeenCalledWith({
                inclusionColumn: 'inclusion_col',
            });
        });
    });
});
