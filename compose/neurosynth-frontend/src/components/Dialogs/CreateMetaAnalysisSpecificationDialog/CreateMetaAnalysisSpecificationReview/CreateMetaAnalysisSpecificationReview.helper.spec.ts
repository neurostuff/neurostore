import { IAnalysesSelection } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import { getWeightAndConditionsForSpecification } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationReview/CreateMetaAnalysisSpecificationReview.helpers';
import { EPropertyType } from 'components/EditMetadata';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

describe('CreateMetaAnalysisSpecificationReviewHelpers', () => {
    describe('getWeightAndConditionsForSpecification', () => {
        it('should set multiple weights and multiple conditions if the reference database is not default', () => {
            const mockEstimator: IAutocompleteObject = {
                label: 'ALESubtraction',
                description: '',
            };

            const mockSelection: IAnalysesSelection = {
                selectionKey: 'key',
                selectionValue: 'val-selected',
                referenceDataset: 'val-reference',
                type: EPropertyType.STRING,
            };

            const result = getWeightAndConditionsForSpecification(mockEstimator, mockSelection);

            expect(result.weights).toEqual([1, -1]);
            expect(result.conditions).toEqual(['val-selected', 'val-reference']);
            expect(result.databaseStudyset).toBeUndefined();
        });

        it('should return empty lists if the estimator is not defined', () => {
            const mockSelection: IAnalysesSelection = {
                selectionKey: 'key',
                selectionValue: 'val',
                referenceDataset: 'neuroquery',
                type: EPropertyType.STRING,
            };

            const result = getWeightAndConditionsForSpecification(undefined, mockSelection);

            expect(result.conditions.length).toEqual(0);
            expect(result.weights.length).toEqual(0);
            expect(result.databaseStudyset).toBeUndefined();
        });

        it('should set a single weight and a single condition if the reference database is default', () => {
            const mockEstimator: IAutocompleteObject = {
                label: 'ALESubtraction',
                description: '',
            };

            const mockSelection: IAnalysesSelection = {
                selectionKey: 'key',
                selectionValue: 'val',
                referenceDataset: 'neuroquery',
                type: EPropertyType.STRING,
            };

            const result = getWeightAndConditionsForSpecification(mockEstimator, mockSelection);

            expect(result.conditions.length).toEqual(1);
            expect(result.weights).toEqual([1]);
            expect(result.databaseStudyset).toEqual('neuroquery');
        });

        it('should parse the array into correct boolean types', () => {
            let mockEstimator: IAutocompleteObject = {
                label: 'ALESubtraction',
                description: '',
            };

            let mockSelection: IAnalysesSelection = {
                selectionKey: 'key',
                selectionValue: 'true',
                referenceDataset: 'false',
                type: EPropertyType.BOOLEAN,
            };

            let result = getWeightAndConditionsForSpecification(mockEstimator, mockSelection);
            expect(result.conditions).toEqual([true, false]);

            mockEstimator = {
                label: 'ALESubtraction',
                description: '',
            };

            mockSelection = {
                selectionKey: 'key',
                selectionValue: true,
                referenceDataset: 'false',
                type: EPropertyType.BOOLEAN,
            };

            result = getWeightAndConditionsForSpecification(mockEstimator, mockSelection);
            expect(result.conditions).toEqual([true, false]);
        });

        it('should parse the array into correct string types', () => {
            let mockEstimator: IAutocompleteObject = {
                label: 'ALESubtraction',
                description: '',
            };

            let mockSelection: IAnalysesSelection = {
                selectionKey: 'key',
                selectionValue: 'true',
                referenceDataset: 'false',
                type: EPropertyType.STRING,
            };

            let result = getWeightAndConditionsForSpecification(mockEstimator, mockSelection);
            expect(result.conditions).toEqual(['true', 'false']);
        });
    });
});
