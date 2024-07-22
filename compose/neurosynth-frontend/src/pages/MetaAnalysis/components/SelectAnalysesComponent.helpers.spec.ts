import {
    selectedReferenceDatasetIsDefaultDataset,
    isMultiGroupAlgorithm,
} from 'pages/MetaAnalysis/components/SelectAnalysesComponent.helpers';
import {
    DEFAULT_REFERENCE_DATASETS,
    MULTIGROUP_ALGORITHMS,
} from 'pages/MetaAnalysis/components/SelectAnalysesComponent.types';

describe('SelectAnalysesComponentHelpers', () => {
    describe('selectedReferenceDatasetIsDefaultDataset', () => {
        it('should be truthy for default datasets', () => {
            DEFAULT_REFERENCE_DATASETS.forEach((dataset) => {
                const result = selectedReferenceDatasetIsDefaultDataset(dataset.id);
                expect(result).toBeTruthy();
            });
        });

        it('should return false for non reference datasets', () => {
            const result = selectedReferenceDatasetIsDefaultDataset('random dataset');
            expect(result).toBeFalsy();
        });

        it('should return false for undefined', () => {
            const result = selectedReferenceDatasetIsDefaultDataset(undefined);
            expect(result).toBeFalsy();
        });
    });

    describe('isMultiGroupAlgorithm', () => {
        it('should be truthy for multigroup algorithms', () => {
            MULTIGROUP_ALGORITHMS.forEach((multigroupAlgorithm) => {
                const result = isMultiGroupAlgorithm({
                    label: multigroupAlgorithm,
                    description: '',
                });
                expect(result).toBeTruthy();
            });
        });

        it('should return false for non reference datasets', () => {
            const result = isMultiGroupAlgorithm({ label: 'random', description: '' });
            expect(result).toBeFalsy();
        });

        it('should return false for undefined', () => {
            const result = isMultiGroupAlgorithm(undefined);
            expect(result).toBeFalsy();
        });
    });
});
