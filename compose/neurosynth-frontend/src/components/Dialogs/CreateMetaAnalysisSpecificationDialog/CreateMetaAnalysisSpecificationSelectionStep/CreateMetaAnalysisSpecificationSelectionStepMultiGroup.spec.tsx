import { render, screen } from '@testing-library/react';
import CreateMetaAnalysisSpecificationSelectionStepMultiGroup from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/CreateMetaAnalysisSpecificationSelectionStepMultiGroup';
import { EPropertyType } from 'components/EditMetadata';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from '../CreateMetaAnalysisSpecificationDialogBase.types';
import userEvent from '@testing-library/user-event';
import { DEFAULT_REFERENCE_DATASETS } from './SelectAnalysesComponent/SelectAnalysesComponent.types';

jest.mock(
    'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/useInclusionColumnOptions'
);
jest.mock('components/NeurosynthAutocomplete/NeurosynthAutocomplete');

describe('CreateMetaAnalysisSpecificationSelectionStepMultiGroup', () => {
    const algorithmMock: IAlgorithmSelection = {
        estimator: { label: 'Test Estimator', description: 'text estimator description' },
        estimatorArgs: {},
        corrector: null,
        correctorArgs: {},
    };

    const selectedValueMock: IAnalysesSelection = {
        selectionKey: 'selection-key',
        type: EPropertyType.STRING,
        selectionValue: 'selection-value',
    };

    const mockSelectValue = jest.fn();

    it('should render', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );
    });

    it('should show the options in the autocomplete dropdown', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );

        ['val-1', 'val-2', 'val-3'].forEach((val) => {
            expect(screen.getByText(val)).toBeInTheDocument();
        });
    });

    it('should show the default reference datasets in the autocomplete dropdown', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );

        DEFAULT_REFERENCE_DATASETS.forEach((dataset) => {
            expect(screen.getByText(dataset.label)).toBeInTheDocument();
        });
    });

    it('should select the correct option', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );
        const button = screen.getByText('val-1');
        userEvent.click(button);

        expect(mockSelectValue).toHaveBeenCalled();
    });
});
