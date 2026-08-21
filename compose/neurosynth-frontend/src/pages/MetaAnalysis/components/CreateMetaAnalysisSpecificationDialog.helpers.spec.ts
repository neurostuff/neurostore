import { EAnalysisType } from 'hooks/projects/Project.types';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import {
    correctorDefaultOption,
    correctorOptions,
    getAlgorithmDefaultOption,
    getDefaultValuesForTypeAndParameter,
    getMetaAnalyticAlgorithms,
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

        it('defaults IBMA to Fishers', () => {
            const defaultOption = getAlgorithmDefaultOption(EAnalysisType.IBMA);

            expect(defaultOption).not.toBeNull();
            expect(defaultOption?.label).toBe('Fishers');
            expect(defaultOption?.description).toBe(metaAnalysisSpecification.IBMA.Fishers.summary);
        });
    });

    describe('correctorOptions / correctorDefaultOption', () => {
        it('lists every CORRECTOR with its summary', () => {
            const correctorKeys = Object.keys(metaAnalysisSpecification.CORRECTOR);

            expect(correctorOptions).toHaveLength(correctorKeys.length);
            expect(correctorOptions.map((option) => option.label).sort()).toEqual([...correctorKeys].sort());
            for (const option of correctorOptions) {
                expect(option.description).toBe(metaAnalysisSpecification.CORRECTOR[option.label].summary);
            }
        });

        it('defaults the corrector to FDRCorrector', () => {
            expect(correctorDefaultOption).not.toBeNull();
            expect(correctorDefaultOption?.label).toBe('FDRCorrector');
            expect(correctorDefaultOption?.description).toBe(
                metaAnalysisSpecification.CORRECTOR.FDRCorrector.summary
            );
        });
    });

    describe('getDefaultValuesForTypeAndParameter', () => {
        it('returns an empty object when parameterLabel is missing', () => {
            expect(getDefaultValuesForTypeAndParameter(EAnalysisType.CBMA, undefined)).toEqual({});
            expect(getDefaultValuesForTypeAndParameter('CORRECTOR', undefined)).toEqual({});
        });

        it('maps CBMA estimator parameter defaults, using {} for kwargs', () => {
            const defaults = getDefaultValuesForTypeAndParameter(EAnalysisType.CBMA, 'ALE');
            const aleParams = metaAnalysisSpecification.CBMA.ALE.parameters;

            expect(defaults.null_method).toBe(aleParams.null_method.default);
            expect(defaults.n_iters).toBe(aleParams.n_iters.default);
            expect(defaults.kernel__fwhm).toBe(aleParams.kernel__fwhm.default);
            expect(defaults.kernel__sample_size).toBe(aleParams.kernel__sample_size.default);
            expect(defaults['**kwargs']).toEqual({});
        });

        it('maps IBMA estimator parameter defaults', () => {
            const defaults = getDefaultValuesForTypeAndParameter(EAnalysisType.IBMA, 'Fishers');
            const fishersParams = metaAnalysisSpecification.IBMA.Fishers.parameters;

            expect(defaults.aggressive_mask).toBe(fishersParams.aggressive_mask.default);
            expect(defaults.use_sample_size).toBe(fishersParams.use_sample_size.default);
            expect(defaults.two_sided).toBe(fishersParams.two_sided.default);
        });

        it('maps FDRCorrector defaults without estimator context', () => {
            const defaults = getDefaultValuesForTypeAndParameter('CORRECTOR', 'FDRCorrector');
            const fdrParams = metaAnalysisSpecification.CORRECTOR.FDRCorrector.parameters;

            expect(defaults).toEqual({
                method: fdrParams.method.default,
                alpha: fdrParams.alpha.default,
            });
        });

        it('uses base FWECorrector defaults when no FWE-enabled estimator is provided', () => {
            const defaults = getDefaultValuesForTypeAndParameter('CORRECTOR', 'FWECorrector');
            const fweParams = metaAnalysisSpecification.CORRECTOR.FWECorrector.parameters;

            expect(defaults.method).toBe(fweParams.method.default);
            expect(defaults.voxel_thresh).toBe(fweParams.voxel_thresh.default);
            expect(defaults.n_iters).toBe(fweParams.n_iters.default);
            expect(defaults['**kwargs']).toEqual({});
        });

        it('uses base FWECorrector defaults when the estimator does not enable FWE', () => {
            const defaults = getDefaultValuesForTypeAndParameter(
                'CORRECTOR',
                'FWECorrector',
                'ALESubtraction',
                EAnalysisType.CBMA
            );
            const fweParams = metaAnalysisSpecification.CORRECTOR.FWECorrector.parameters;

            expect(defaults.method).toBe(fweParams.method.default);
            expect(defaults.voxel_thresh).toBe(fweParams.voxel_thresh.default);
            expect(defaults.n_iters).toBe(fweParams.n_iters.default);
            expect(Object.keys(defaults)).not.toContain('vfwe_only');
        });

        it('merges FWE_parameters from an FWE-enabled CBMA estimator and forces method to montecarlo', () => {
            const aleFweParams = metaAnalysisSpecification.CBMA.ALE.FWE_parameters;
            expect(aleFweParams).not.toBeNull();

            const defaults = getDefaultValuesForTypeAndParameter(
                'CORRECTOR',
                'FWECorrector',
                'ALE',
                EAnalysisType.CBMA
            );

            expect(defaults.method).toBe('montecarlo');
            expect(defaults.voxel_thresh).toBe(aleFweParams!.voxel_thresh.default);
            expect(defaults.n_iters).toBe(aleFweParams!.n_iters.default);
            expect(defaults.vfwe_only).toBe(aleFweParams!.vfwe_only.default);
            expect(defaults).not.toHaveProperty('**kwargs');
        });

        it('merges FWE_parameters from an FWE-enabled IBMA estimator and forces method to montecarlo', () => {
            const permutedFweParams = metaAnalysisSpecification.IBMA.PermutedOLS.FWE_parameters;
            expect(permutedFweParams).not.toBeNull();

            const defaults = getDefaultValuesForTypeAndParameter(
                'CORRECTOR',
                'FWECorrector',
                'PermutedOLS',
                EAnalysisType.IBMA
            );

            expect(defaults.method).toBe('montecarlo');
            expect(defaults.n_iters).toBe(permutedFweParams!.n_iters.default);
            expect(Object.keys(defaults).sort()).toEqual(['method', 'n_iters'].sort());
        });

        it('ignores a partial estimator reference (label without type)', () => {
            const defaults = getDefaultValuesForTypeAndParameter('CORRECTOR', 'FWECorrector', 'ALE');
            const fweParams = metaAnalysisSpecification.CORRECTOR.FWECorrector.parameters;

            expect(defaults.method).toBe(fweParams.method.default);
            expect(defaults).not.toHaveProperty('vfwe_only');
        });
    });
});
