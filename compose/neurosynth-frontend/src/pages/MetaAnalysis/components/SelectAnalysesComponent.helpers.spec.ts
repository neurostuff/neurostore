import {
    filterStudyAnalysesTable,
    IStudyAnalysesTableFormat,
    isMultiGroupAlgorithm,
    selectedReferenceDatasetIsDefaultDataset,
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

    describe('filterStudyAnalysesTable', () => {
        const studies: IStudyAnalysesTableFormat[] = [
            {
                studyId: 's1',
                studyName: 'Alpha Study',
                analyses: [
                    { analysisId: 'a1', analysisName: 'Motor', isSelected: true },
                    { analysisId: 'a2', analysisName: 'Visual', isSelected: false },
                ],
            },
            {
                studyId: 's2',
                studyName: 'Beta Study',
                analyses: [{ analysisId: 'a3', analysisName: 'Motor', isSelected: true }],
            },
        ];

        it('should return all studies when filters are empty', () => {
            expect(filterStudyAnalysesTable(studies, undefined, undefined)).toEqual(studies);
            expect(filterStudyAnalysesTable(studies, '  ', '')).toEqual(studies);
        });

        it('should filter studies case-insensitively by name', () => {
            const result = filterStudyAnalysesTable(studies, 'alpha', undefined);
            expect(result).toHaveLength(1);
            expect(result[0].studyName).toBe('Alpha Study');
            expect(result[0].analyses).toHaveLength(2);
        });

        it('should keep only matching analyses and drop studies with no matches', () => {
            const result = filterStudyAnalysesTable(studies, undefined, 'visual');
            expect(result).toHaveLength(1);
            expect(result[0].studyName).toBe('Alpha Study');
            expect(result[0].analyses).toEqual([{ analysisId: 'a2', analysisName: 'Visual', isSelected: false }]);
        });

        it('should apply study and analysis filters together', () => {
            expect(filterStudyAnalysesTable(studies, 'beta', 'visual')).toEqual([]);

            const result = filterStudyAnalysesTable(studies, 'alpha', 'MOTOR');
            expect(result).toHaveLength(1);
            expect(result[0].analyses).toEqual([{ analysisId: 'a1', analysisName: 'Motor', isSelected: true }]);
        });
    });
});
