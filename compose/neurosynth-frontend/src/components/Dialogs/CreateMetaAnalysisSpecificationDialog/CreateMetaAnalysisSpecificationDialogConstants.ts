import { IMetaAnalysisParamsSpecification } from 'components/MetaAnalysisConfigComponents';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const metaAnalyticAlgorithms: IAutocompleteObject[] = Object.keys(
    metaAnalysisSpecification[EAnalysisType.CBMA]
).map((algoName) => ({
    label: algoName,
    description: metaAnalysisSpecification[EAnalysisType.CBMA][algoName]?.summary || '',
}));

const correctorOptions: IAutocompleteObject[] = Object.keys(
    metaAnalysisSpecification.CORRECTOR
).map((corrector) => ({
    label: corrector,
    description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
}));

const correctorOpt =
    correctorOptions.find((corrector) => corrector.label === 'FDRCorrector') || null;
const algorithmOpt = metaAnalyticAlgorithms.find((algo) => algo.label === 'MKDADensity') || null;

export {
    metaAnalysisSpecification,
    metaAnalyticAlgorithms,
    correctorOptions,
    correctorOpt,
    algorithmOpt,
};
