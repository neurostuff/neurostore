import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { mockAnnotations, mockStudysets } from '../../../testing/mockData';
import MetaAnalysisFinalize from './MetaAnalysisFinalize';

jest.mock('../../Buttons/NavigationButtons/NavigationButtons');
describe('MetaAnalysisFinalize', () => {
    const mockOnNext = jest.fn();
    it('should render', () => {
        render(
            <MetaAnalysisFinalize
                onNext={mockOnNext}
                analysisType={EAnalysisType.CBMA}
                estimator={{ label: 'ALE', description: 'ALE' }}
                estimatorArgs={{}}
                corrector={undefined}
                correctorArgs={{}}
                studyset={mockStudysets()[0]}
                annotation={mockAnnotations()[0]}
                metaAnalysisDescription=""
                metaAnalysisName="some-name"
                inclusionColumn="some-col"
            />
        );
    });

    it('should call onNext', () => {
        render(
            <MetaAnalysisFinalize
                onNext={mockOnNext}
                analysisType={EAnalysisType.CBMA}
                estimator={{ label: 'ALE', description: 'ALE' }}
                estimatorArgs={{}}
                corrector={undefined}
                correctorArgs={{}}
                studyset={mockStudysets()[0]}
                annotation={mockAnnotations()[0]}
                metaAnalysisDescription=""
                metaAnalysisName="some-name"
                inclusionColumn="some-col"
            />
        );

        const navigationButton = screen.getByTestId('next-button');
        userEvent.click(navigationButton);

        expect(mockOnNext).toHaveBeenCalled();
    });

    it('should show the corrector if it exists', () => {
        render(
            <MetaAnalysisFinalize
                onNext={mockOnNext}
                analysisType={EAnalysisType.CBMA}
                estimator={{ label: 'ALE', description: 'ALE' }}
                estimatorArgs={{}}
                corrector={{ label: 'FWECorrector', description: 'Some description' }}
                correctorArgs={{}}
                studyset={mockStudysets()[0]}
                annotation={mockAnnotations()[0]}
                metaAnalysisDescription=""
                metaAnalysisName="some-name"
                inclusionColumn="some-col"
            />
        );

        expect(screen.getByText('FWECorrector')).toBeInTheDocument();
    });
});
