import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import MetaAnalysisAlgorithm from './MetaAnalysisAlgorithm';
import metaAnalysisSpec from '../../../assets/config/meta_analysis_params.json';
import { IMetaAnalysisParamsSpecification } from '..';

const importedSpec = metaAnalysisSpec as IMetaAnalysisParamsSpecification;

jest.mock('../../NeurosynthAutocomplete/NeurosynthAutocomplete');
jest.mock('./DynamicForm/DynamicForm');
jest.mock('../../Buttons/NavigationButtons/NavigationButtons');

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

    it('should update the dynamic args from the dynamic form', () => {
        render(
            <MetaAnalysisAlgorithm
                metaAnalysisType={EAnalysisType.CBMA}
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
                onArgsUpdate={mockOnArgsUpdate}
                estimatorArgs={{}}
                correctorArgs={{}}
                estimator={{ label: 'ALE', description: 'an estimator' }}
                corrector={undefined} // set as undefined so only one dynamic form renders
            />
        );

        userEvent.click(screen.getByTestId('trigger-update'));
        expect(mockOnArgsUpdate).toHaveBeenCalledWith({
            estimatorArgs: {
                'test-key': 'test-value',
            },
        });
    });

    // do test of all CBMA and IBMA estimators
    describe('estimator metadata', () => {
        const CBMATests = Object.keys(importedSpec.CBMA).map((estimator) => [
            EAnalysisType.CBMA,
            estimator,
        ]);

        const IBMATests = Object.keys(importedSpec.IBMA).map((estimator) => [
            EAnalysisType.IBMA,
            estimator,
        ]);

        const estimators = CBMATests.concat(IBMATests);

        test.each(estimators)(
            'should initialize and update the dynamic args when the %s %s estimator is selected',
            (analysisType, estimator) => {
                const estimatorDetails = (importedSpec as any)[analysisType][estimator];

                render(
                    <MetaAnalysisAlgorithm
                        metaAnalysisType={analysisType as EAnalysisType}
                        onNext={mockOnNext}
                        onUpdate={mockOnUpdate}
                        onArgsUpdate={mockOnArgsUpdate}
                        estimatorArgs={{}}
                        correctorArgs={{}}
                        estimator={undefined}
                        corrector={undefined}
                    />
                );

                userEvent.click(screen.getByTestId('algorithm'));
                userEvent.click(screen.getByText(estimator));

                expect(mockOnUpdate).toHaveBeenCalledWith({
                    estimator: {
                        label: estimator,
                        description: estimatorDetails.summary,
                    },
                });

                const expectedEstimatorArgs = {} as any;
                Object.keys(estimatorDetails.parameters).forEach((param) => {
                    expectedEstimatorArgs[param] =
                        param === '**kwargs' ? {} : estimatorDetails.parameters[param].default;
                });
                expect(mockOnArgsUpdate).toHaveBeenCalledWith({
                    estimatorArgs: expectedEstimatorArgs,
                });
            }
        );
    });

    describe('corrector metadata', () => {
        test.each(['FWECorrector', 'FDRCorrector'])(
            'should initialize and update the dynamic args when the %s corrector is selected',
            (corrector) => {
                const correctorDetails = (importedSpec as any).CORRECTOR[corrector];

                render(
                    <MetaAnalysisAlgorithm
                        metaAnalysisType={EAnalysisType.CBMA}
                        onNext={mockOnNext}
                        onUpdate={mockOnUpdate}
                        onArgsUpdate={mockOnArgsUpdate}
                        estimatorArgs={{}}
                        correctorArgs={{}}
                        estimator={undefined}
                        corrector={undefined}
                    />
                );

                userEvent.click(screen.getByTestId('corrector (optional)'));
                userEvent.click(screen.getByText(corrector));

                expect(mockOnUpdate).toHaveBeenCalledWith({
                    corrector: {
                        label: corrector,
                        description: correctorDetails.summary,
                    },
                });

                const expectedCorrectorArgs = {} as any;
                Object.keys(correctorDetails.parameters).forEach((param) => {
                    expectedCorrectorArgs[param] =
                        param === '**kwargs' ? {} : correctorDetails.parameters[param].default;
                });

                expect(mockOnArgsUpdate).toHaveBeenCalledWith({
                    correctorArgs: expectedCorrectorArgs,
                });
            }
        );
    });

    it('should hide the estimator dynamic args', () => {
        render(
            <MetaAnalysisAlgorithm
                metaAnalysisType={EAnalysisType.CBMA}
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
                onArgsUpdate={mockOnArgsUpdate}
                estimatorArgs={{}}
                correctorArgs={{}}
                estimator={undefined}
                corrector={{ label: 'FWECorrector', description: 'a corrector' }}
            />
        );

        expect(screen.queryByText('Optional algorithm arguments')).not.toBeInTheDocument();
    });

    it('should hide the corrector dynamic args', () => {
        render(
            <MetaAnalysisAlgorithm
                metaAnalysisType={EAnalysisType.CBMA}
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
                onArgsUpdate={mockOnArgsUpdate}
                estimatorArgs={{}}
                correctorArgs={{}}
                estimator={{ label: 'ALE', description: 'an estimator' }}
                corrector={undefined}
            />
        );

        expect(screen.queryByText('Optional corrector arguments')).not.toBeInTheDocument();
    });

    it('should call onNext', () => {
        render(
            <MetaAnalysisAlgorithm
                metaAnalysisType={EAnalysisType.CBMA}
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
                onArgsUpdate={mockOnArgsUpdate}
                estimatorArgs={{}}
                correctorArgs={{}}
                estimator={{ label: 'ALE', description: 'an estimator' }}
                corrector={undefined}
            />
        );

        userEvent.click(screen.getByTestId('next-button'));
        expect(mockOnNext).toHaveBeenCalled();
    });
});
