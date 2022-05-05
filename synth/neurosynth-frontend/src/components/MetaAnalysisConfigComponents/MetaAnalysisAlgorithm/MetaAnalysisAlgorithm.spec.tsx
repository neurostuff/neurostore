import { render } from '@testing-library/react';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import MetaAnalysisAlgorithm from './MetaAnalysisAlgorithm';

describe('MetaAnalysisAlgorithm component', () => {
    const mockOnArgsUpdate = jest.fn();
    const mockOnNext = jest.fn();
    const mockOnUpdate = jest.fn();

    it('should render', () => {
        render(
            <MetaAnalysisAlgorithm
                metaAnalysisType={EAnalysisType.CBMA}
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
                onArgsUpdate={mockOnArgsUpdate}
                estimatorArgs={{}}
                correctorArgs={{}}
                estimator={{ label: 'ALE', description: 'an estimator' }}
                corrector={{ label: 'FWECorrector', description: 'a corrector' }}
            />
        );
    });

    it('should ', () => {});
});
