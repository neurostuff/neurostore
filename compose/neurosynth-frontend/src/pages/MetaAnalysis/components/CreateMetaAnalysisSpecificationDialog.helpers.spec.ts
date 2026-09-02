import { EAnalysisType } from 'hooks/projects/Project.types';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import {
    getAlgorithmDefaultOption,
    getCorrectorDefaultOption,
    getDefaultValuesForAlgorithm,
    getDefaultValuesForCorrector,
    getMetaAnalyticAlgorithms,
    getMetaAnalyticCorrectors,
    metaAnalysisSpecification,
} from './CreateMetaAnalysisSpecificationDialog.helpers';

describe('CreateMetaAnalysisSpecificationDialog.helpers', () => {
    describe('metaAnalysisSpecification', () => {
        it('exposes the shared params config used by the helpers', () => {
            expect(metaAnalysisSpecification).toBe(metaAnalysisSpec);
            expect(metaAnalysisSpecification.VERSION).toBe(metaAnalysisSpec.VERSION);
            expect(Object.keys(metaAnalysisSpecification.CBMA).length).toBeGreaterThan(0);
            expect(Object.keys(metaAnalysisSpecification.IBMA).length).toBeGreaterThan(0);
            expect(Object.keys(metaAnalysisSpecification.CORRECTOR).length).toBeGreaterThan(0);
        });
    });

    describe('getMetaAnalyticAlgorithms', () => {
        it('returns one option per CBMA algorithm with label and summary description', () => {
            const algorithms = getMetaAnalyticAlgorithms(EAnalysisType.CBMA);
            const cbmaKeys = Object.keys(metaAnalysisSpecification.CBMA);

            expect(algorithms).toHaveLength(cbmaKeys.length);
            expect(algorithms.map((algo) => algo.label).sort()).toEqual([...cbmaKeys].sort());
            for (const algo of algorithms) {
                expect(algo.description).toBe(metaAnalysisSpecification.CBMA[algo.label].summary);
            }
        });

        it('returns only Fishers and Stouffers for IBMA MVP', () => {
            const algorithms = getMetaAnalyticAlgorithms(EAnalysisType.IBMA);

            expect(algorithms.map((algo) => algo.label)).toEqual(['Fishers', 'Stouffers']);
            for (const algo of algorithms) {
                expect(algo.description).toBe(metaAnalysisSpecification.IBMA[algo.label].summary);
            }
        });

        it('does not mix CBMA and IBMA algorithm names', () => {
            const cbmaLabels = new Set(getMetaAnalyticAlgorithms(EAnalysisType.CBMA).map((algo) => algo.label));
            const ibmaLabels = new Set(getMetaAnalyticAlgorithms(EAnalysisType.IBMA).map((algo) => algo.label));

            expect(cbmaLabels.has('MKDADensity')).toBe(true);
            expect(cbmaLabels.has('Fishers')).toBe(false);
            expect(ibmaLabels.has('Fishers')).toBe(true);
            expect(ibmaLabels.has('Stouffers')).toBe(true);
            expect(ibmaLabels.has('PermutedOLS')).toBe(false);
            expect(ibmaLabels.has('MKDADensity')).toBe(false);

            for (const label of cbmaLabels) {
                expect(ibmaLabels.has(label)).toBe(false);
            }
        });
    });

    describe('getAlgorithmDefaultOption', () => {
        it('defaults CBMA to MKDADensity when present', () => {
            const defaultOption = getAlgorithmDefaultOption(EAnalysisType.CBMA);
            expect(defaultOption).not.toBeNull();
            expect(defaultOption?.label).toBe('MKDADensity');
            expect(defaultOption?.description).toBe(metaAnalysisSpecification.CBMA.MKDADensity.summary);
        });

        it('defaults IBMA to Stouffers', () => {
            const defaultOption = getAlgorithmDefaultOption(EAnalysisType.IBMA);

            expect(defaultOption).not.toBeNull();
            expect(defaultOption?.label).toBe('Stouffers');
            expect(defaultOption?.description).toBe(metaAnalysisSpecification.IBMA.Stouffers.summary);
        });
    });

    describe('getMetaAnalyticCorrectors', () => {
        it('returns every CORRECTOR with its summary for CBMA', () => {
            const correctors = getMetaAnalyticCorrectors(EAnalysisType.CBMA);
            const correctorKeys = Object.keys(metaAnalysisSpecification.CORRECTOR);

            expect(correctors).toHaveLength(correctorKeys.length);
            expect(correctors.map((option) => option.label).sort()).toEqual([...correctorKeys].sort());
            expect(correctors.map((option) => option.label)).toContain('FWECorrector');
            for (const option of correctors) {
                expect(option.description).toBe(metaAnalysisSpecification.CORRECTOR[option.label].summary);
            }
        });

        it('omits FWECorrector for IBMA', () => {
            const correctors = getMetaAnalyticCorrectors(EAnalysisType.IBMA);

            expect(correctors.map((option) => option.label)).toEqual(['FDRCorrector']);
            expect(correctors.map((option) => option.label)).not.toContain('FWECorrector');
            expect(correctors[0].description).toBe(metaAnalysisSpecification.CORRECTOR.FDRCorrector.summary);
        });
    });

    describe('getCorrectorDefaultOption', () => {
        it('defaults CBMA to FDRCorrector', () => {
            const defaultOption = getCorrectorDefaultOption(EAnalysisType.CBMA);
            expect(defaultOption).not.toBeNull();
            expect(defaultOption?.label).toBe('FDRCorrector');
            expect(defaultOption?.description).toBe(metaAnalysisSpecification.CORRECTOR.FDRCorrector.summary);
        });

        it('defaults IBMA to FDRCorrector', () => {
            const defaultOption = getCorrectorDefaultOption(EAnalysisType.IBMA);
            expect(defaultOption).not.toBeNull();
            expect(defaultOption?.label).toBe('FDRCorrector');
            expect(defaultOption?.description).toBe(metaAnalysisSpecification.CORRECTOR.FDRCorrector.summary);
        });
    });

    describe('getDefaultValuesForAlgorithm', () => {
        it('returns an empty object when algorithm is missing', () => {
            expect(getDefaultValuesForAlgorithm(EAnalysisType.CBMA, undefined)).toEqual({});
        });

        it('maps CBMA estimator parameter defaults, using {} for kwargs', () => {
            const defaults = getDefaultValuesForAlgorithm(EAnalysisType.CBMA, 'ALE');
            const aleParams = metaAnalysisSpecification.CBMA.ALE.parameters;

            expect(defaults.null_method).toBe(aleParams.null_method.default);
            expect(defaults.n_iters).toBe(aleParams.n_iters.default);
            expect(defaults.kernel__fwhm).toBe(aleParams.kernel__fwhm.default);
            expect(defaults.kernel__sample_size).toBe(aleParams.kernel__sample_size.default);
            expect(defaults['**kwargs']).toEqual({});
        });

        it('maps IBMA estimator parameter defaults', () => {
            const defaults = getDefaultValuesForAlgorithm(EAnalysisType.IBMA, 'Fishers');
            const fishersParams = metaAnalysisSpecification.IBMA.Fishers.parameters;

            expect(defaults.aggressive_mask).toBe(fishersParams.aggressive_mask.default);
            expect(defaults.use_sample_size).toBe(fishersParams.use_sample_size.default);
            expect(defaults.two_sided).toBe(fishersParams.two_sided.default);
        });
    });

    describe('getDefaultValuesForCorrector', () => {
        it('returns an empty object when corrector or algorithm is missing', () => {
            expect(getDefaultValuesForCorrector(EAnalysisType.CBMA, undefined, 'ALE')).toEqual({});
            expect(getDefaultValuesForCorrector(EAnalysisType.CBMA, 'FDRCorrector', undefined)).toEqual({});
        });

        it('returns an empty object for an unknown corrector', () => {
            expect(getDefaultValuesForCorrector(EAnalysisType.CBMA, 'NotACorrector', 'ALE')).toEqual({});
        });

        it('maps FDRCorrector defaults', () => {
            const defaults = getDefaultValuesForCorrector(EAnalysisType.CBMA, 'FDRCorrector', 'ALE');
            const fdrParams = metaAnalysisSpecification.CORRECTOR.FDRCorrector.parameters;

            expect(defaults).toEqual({
                method: fdrParams.method.default,
                alpha: fdrParams.alpha.default,
            });
        });

        it('uses base FWECorrector defaults when the estimator does not enable FWE', () => {
            const defaults = getDefaultValuesForCorrector(EAnalysisType.CBMA, 'FWECorrector', 'ALESubtraction');
            const fweParams = metaAnalysisSpecification.CORRECTOR.FWECorrector.parameters;

            expect(defaults.method).toBe(fweParams.method.default);
            expect(defaults.voxel_thresh).toBe(fweParams.voxel_thresh.default);
            expect(defaults.n_iters).toBe(fweParams.n_iters.default);
            expect(Object.keys(defaults)).not.toContain('vfwe_only');
        });

        it('uses FWE_parameters from an FWE-enabled CBMA estimator', () => {
            const aleFweParams = metaAnalysisSpecification.CBMA.ALE.FWE_parameters;
            expect(aleFweParams).not.toBeNull();

            const defaults = getDefaultValuesForCorrector(EAnalysisType.CBMA, 'FWECorrector', 'ALE');

            expect(defaults.voxel_thresh).toBe(aleFweParams!.voxel_thresh.default);
            expect(defaults.n_iters).toBe(aleFweParams!.n_iters.default);
            expect(defaults.vfwe_only).toBe(aleFweParams!.vfwe_only.default);
            expect(defaults.method).toBe('montecarlo');
            expect(defaults).not.toHaveProperty('**kwargs');
        });

        it('uses FWE_parameters from an FWE-enabled IBMA estimator', () => {
            const permutedFweParams = metaAnalysisSpecification.IBMA.PermutedOLS.FWE_parameters;
            expect(permutedFweParams).not.toBeNull();

            const defaults = getDefaultValuesForCorrector(EAnalysisType.IBMA, 'FWECorrector', 'PermutedOLS');

            expect(defaults.n_iters).toBe(permutedFweParams!.n_iters.default);
            expect(defaults.method).toBe('montecarlo');
            expect(Object.keys(defaults).sort()).toEqual(['method', 'n_iters']);
        });
    });
});
