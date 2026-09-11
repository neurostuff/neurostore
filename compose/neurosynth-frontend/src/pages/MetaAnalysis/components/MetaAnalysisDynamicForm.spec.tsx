import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EAnalysisType } from 'hooks/projects/Project.types';
import MetaAnalysisDynamicForm from './MetaAnalysisDynamicForm';

vi.mock('pages/MetaAnalysis/components/DynamicFormBoolInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormKwargInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormKwargToggleVisibility');
vi.mock('pages/MetaAnalysis/components/DynamicFormNumericInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormSelectInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormStringInput');
vi.mock('pages/MetaAnalysis/components/MetaAnalysisDynamicFormALE');

describe('MetaAnalysisDynamicForm', () => {
    const mockOnUpdate = vi.fn();

    it('should render the ALE form when the estimator is ALE', () => {
        render(
            <MetaAnalysisDynamicForm
                type={EAnalysisType.CBMA}
                correctorOrEstimatorLabel="ALE"
                values={{}}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByTestId('meta-analysis-dynamic-form-ale')).toBeInTheDocument();
        expect(screen.queryByTestId('dynamic-form-input')).not.toBeInTheDocument();
    });

    it('should render the default parameter inputs when the estimator is not ALE', () => {
        render(
            <MetaAnalysisDynamicForm
                type={EAnalysisType.CBMA}
                correctorOrEstimatorLabel="MKDADensity"
                values={{}}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.queryByTestId('meta-analysis-dynamic-form-ale')).not.toBeInTheDocument();
        expect(screen.getAllByTestId('dynamic-form-input').length).toBeGreaterThan(0);
        expect(screen.getByTestId('dynamic-form-kwarg-toggle')).toBeInTheDocument();
    });
});
