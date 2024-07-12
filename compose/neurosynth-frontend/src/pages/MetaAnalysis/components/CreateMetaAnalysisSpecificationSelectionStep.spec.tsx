import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import CreateMetaAnalysisSpecificationSelectionStep from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationSelectionStep';
import { MULTIGROUP_ALGORITHMS } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.types';

jest.mock('pages/Projects/ProjectPage/ProjectStore');
jest.mock(
    'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent'
);
jest.mock(
    'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesSummaryComponent'
);
jest.mock(
    'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/CreateMetaAnalysisSpecificationSelectionStepMultiGroup'
);

describe('CreateMetaAnalysisSpecificationSelectionStep', () => {
    let algorithmMock: IAlgorithmSelection = {
        estimator: { label: 'Test Estimator', description: 'text estimator description' },
        estimatorArgs: {},
        corrector: null,
        correctorArgs: {},
    };

    let selectedValueMock: IAnalysesSelection = {
        selectionKey: 'selection-key',
        type: EPropertyType.STRING,
        selectionValue: 'selection-value',
    };

    const mockOnChooseSelection = jest.fn();
    const mockOnNavigate = jest.fn();

    beforeEach(() => {
        selectedValueMock = {
            selectionKey: 'selection-key',
            type: EPropertyType.STRING,
            selectionValue: 'selection-value',
        };

        algorithmMock = {
            estimator: { label: 'Test Estimator', description: 'text estimator description' },
            estimatorArgs: {},
            corrector: null,
            correctorArgs: {},
        };
    });

    it('should render', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStep
                algorithm={algorithmMock}
                selection={selectedValueMock}
                onChooseSelection={mockOnChooseSelection}
                onNavigate={mockOnNavigate}
            />
        );
    });

    it('should hide the multigroup selection component if the estimator is not a multigroup estimator', () => {
        algorithmMock = {
            estimator: {
                label: 'Random estimator',
                description: 'text estimator description',
            },
            estimatorArgs: {},
            corrector: null,
            correctorArgs: {},
        };

        render(
            <CreateMetaAnalysisSpecificationSelectionStep
                algorithm={algorithmMock}
                selection={selectedValueMock}
                onChooseSelection={mockOnChooseSelection}
                onNavigate={mockOnNavigate}
            />
        );

        expect(
            screen.queryByTestId('CreateMetaAnalysisSpecificationSelectionStepMultiGroup')
        ).not.toBeInTheDocument();
    });

    it('should show the multigroup selection component if the estimator is a multigroup estimator', () => {
        algorithmMock = {
            estimator: {
                label: MULTIGROUP_ALGORITHMS[0],
                description: 'text estimator description',
            },
            estimatorArgs: {},
            corrector: null,
            correctorArgs: {},
        };

        render(
            <CreateMetaAnalysisSpecificationSelectionStep
                algorithm={algorithmMock}
                selection={selectedValueMock}
                onChooseSelection={mockOnChooseSelection}
                onNavigate={mockOnNavigate}
            />
        );

        expect(
            screen.getByTestId('CreateMetaAnalysisSpecificationSelectionStepMultiGroup')
        ).toBeInTheDocument();
    });

    describe('navigation', () => {
        it('should go back', () => {
            render(
                <CreateMetaAnalysisSpecificationSelectionStep
                    algorithm={algorithmMock}
                    selection={selectedValueMock}
                    onChooseSelection={mockOnChooseSelection}
                    onNavigate={mockOnNavigate}
                />
            );

            const backButton = screen.getByRole('button', { name: 'back' });
            userEvent.click(backButton);

            expect(mockOnNavigate).toHaveBeenCalledWith(ENavigationButton.PREV);
        });

        it('should go forward', () => {
            render(
                <CreateMetaAnalysisSpecificationSelectionStep
                    algorithm={algorithmMock}
                    selection={selectedValueMock}
                    onChooseSelection={mockOnChooseSelection}
                    onNavigate={mockOnNavigate}
                />
            );

            const nextButton = screen.getByRole('button', { name: 'next' });
            userEvent.click(nextButton);

            expect(mockOnNavigate).toHaveBeenCalledWith(ENavigationButton.NEXT);
        });

        it('should disable the next button when selection key is undefined', () => {
            selectedValueMock = {
                selectionKey: undefined,
                type: EPropertyType.STRING,
                selectionValue: 'selection-value',
            };

            render(
                <CreateMetaAnalysisSpecificationSelectionStep
                    algorithm={algorithmMock}
                    selection={selectedValueMock}
                    onChooseSelection={mockOnChooseSelection}
                    onNavigate={mockOnNavigate}
                />
            );

            const nextButton = screen.getByRole('button', { name: 'next' });
            expect(nextButton).toBeDisabled();
        });

        it('should disable the next button when the selection value is undefined', () => {
            selectedValueMock = {
                selectionKey: 'key',
                type: EPropertyType.STRING,
                selectionValue: undefined,
            };

            render(
                <CreateMetaAnalysisSpecificationSelectionStep
                    algorithm={algorithmMock}
                    selection={selectedValueMock}
                    onChooseSelection={mockOnChooseSelection}
                    onNavigate={mockOnNavigate}
                />
            );

            const nextButton = screen.getByRole('button', { name: 'next' });
            expect(nextButton).toBeDisabled();
        });

        it('should disable the next button when the estimator is multi group and the reference dataset is undefined', () => {
            selectedValueMock = {
                selectionKey: 'key',
                type: EPropertyType.STRING,
                selectionValue: 'value',
                referenceDataset: undefined,
            };

            algorithmMock = {
                estimator: {
                    label: MULTIGROUP_ALGORITHMS[0],
                    description: 'text estimator description',
                },
                estimatorArgs: {},
                corrector: null,
                correctorArgs: {},
            };

            render(
                <CreateMetaAnalysisSpecificationSelectionStep
                    algorithm={algorithmMock}
                    selection={selectedValueMock}
                    onChooseSelection={mockOnChooseSelection}
                    onNavigate={mockOnNavigate}
                />
            );

            const nextButton = screen.getByRole('button', { name: 'next' });
            expect(nextButton).toBeDisabled();
        });
    });
});
