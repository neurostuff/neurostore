import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useCreateMetaAnalysis } from 'hooks';
import { EAnalysisType } from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { mockAnnotations, mockStudysets } from 'testing/mockData';
import MetaAnalysisFinalize from './MetaAnalysisFinalize';

jest.mock('hooks');

describe('MetaAnalysisFinalize', () => {
    const mockOnNavigate = jest.fn();
    it('should render', () => {
        render(
            <MetaAnalysisFinalize
                onNavigate={mockOnNavigate}
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

    it('should call onNavigate', () => {
        render(
            <MetaAnalysisFinalize
                onNavigate={mockOnNavigate}
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

        userEvent.click(screen.getByRole('button', { name: 'back' }));
        expect(mockOnNavigate).toHaveBeenCalledWith(ENavigationButton.PREV);
    });

    it('should show the corrector if it exists', () => {
        render(
            <MetaAnalysisFinalize
                onNavigate={mockOnNavigate}
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

    it('should create the meta-analysis', () => {
        render(
            <MetaAnalysisFinalize
                onNavigate={mockOnNavigate}
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

        userEvent.click(screen.getByRole('button', { name: 'create meta-analysis' }));
        expect(useCreateMetaAnalysis().createMetaAnalysis).toHaveBeenCalledWith(
            {
                analysisType: EAnalysisType.CBMA,
                estimator: { label: 'ALE', description: 'ALE' },
                corrector: { label: 'FWECorrector', description: 'Some description' },
                studyset: mockStudysets()[0],
                annotation: mockAnnotations()[0],
                inclusionColumn: 'some-col',
                metaAnalysisName: 'some-name',
                metaAnalysisDescription: '',
            },
            {
                estimatorArgs: {},
                correctorArgs: {},
            }
        );
    });
});
