import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { IMetaAnalysisParamsSpecification } from './components/DynamicForm.types';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';

export const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

export const getAnalysisTypeDescription = (name: string | undefined): string => {
    switch (name) {
        case EAnalysisType.CBMA:
            return 'Coordinate Based Meta-Analysis';
        case EAnalysisType.IBMA:
            return 'Image Based Meta-Analysis';
        default:
            return '';
    }
};

export const getEstimatorDescription = (type: string | undefined, estimator: string | undefined) => {
    if (!estimator || !type) return '';
    return metaAnalysisSpecification?.[type as 'CBMA' | 'IBMA']?.[estimator].summary || '';
};
