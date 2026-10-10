import { Mock, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import CreateMetaAnalysisSpecificationSelectionStepMultiGroup from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationSelectionStepMultiGroup';
import { DEFAULT_REFERENCE_DATASETS } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.types';
import useInclusionColumnOptions from 'pages/MetaAnalysis/hooks/useInclusionColumnOptions';

vi.mock('pages/MetaAnalysis/hooks/useInclusionColumnOptions');
vi.mock('components/NeurosynthAutocomplete/NeurosynthAutocomplete');

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

    const mockSelectValue = vi.fn();
    const largeReferenceWarning = 'Specifying ALE subtraction with a large reference dataset is not recommended.';

    beforeEach(() => {
        (useInclusionColumnOptions as Mock).mockReturnValue({
            'val-1': 1,
            'val-2': 1,
            'val-3': 1,
        });
    });

    it('should render', async () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );
    });

    it('should show the options in the autocomplete dropdown', async () => {
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

    it('should show the default reference datasets in the autocomplete dropdown', async () => {
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

    it('should select the correct option', async () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={algorithmMock}
                annotationId="abc123"
                selectedValue={selectedValueMock}
                onSelectValue={mockSelectValue}
            />
        );
        const button = screen.getByText('val-1');
        await userEvent.click(button);

        expect(mockSelectValue).toHaveBeenCalled();
    });

    it('should warn when ALE subtraction uses the neurostore reference dataset', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={{
                    ...algorithmMock,
                    estimator: { label: 'ALESubtraction', description: '' },
                }}
                annotationId="abc123"
                selectedValue={{ ...selectedValueMock, referenceDataset: 'neurostore' }}
                onSelectValue={mockSelectValue}
            />
        );

        expect(screen.getByText(largeReferenceWarning, { exact: false })).toBeInTheDocument();
    });

    it('should warn when ALE subtraction uses a custom reference of 1000 or more studies', () => {
        (useInclusionColumnOptions as Mock).mockReturnValue({
            'large-group': 1000,
        });

        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={{
                    ...algorithmMock,
                    estimator: { label: 'ALESubtraction', description: '' },
                }}
                annotationId="abc123"
                selectedValue={{ ...selectedValueMock, referenceDataset: 'large-group' }}
                onSelectValue={mockSelectValue}
            />
        );

        expect(screen.getByText(largeReferenceWarning, { exact: false })).toBeInTheDocument();
    });

    it('should not warn for MKDA chi-square against the neurostore reference dataset', () => {
        render(
            <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                algorithm={{
                    ...algorithmMock,
                    estimator: { label: 'MKDAChi2', description: '' },
                }}
                annotationId="abc123"
                selectedValue={{ ...selectedValueMock, referenceDataset: 'neurostore' }}
                onSelectValue={mockSelectValue}
            />
        );

        expect(screen.queryByText(largeReferenceWarning, { exact: false })).not.toBeInTheDocument();
    });
});
