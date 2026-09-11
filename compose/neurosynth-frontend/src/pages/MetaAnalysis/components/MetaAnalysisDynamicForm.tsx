import { Box } from '@mui/material';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { EAnalysisType } from 'hooks/projects/Project.types';
import {
    IDynamicFormInput,
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
    KWARG_STRING,
} from 'pages/MetaAnalysis/components/DynamicForm.types';
import { getDynamicFormInputComponentByParameter } from 'pages/MetaAnalysis/components/DynamicForm.helpers';
import MetaAnalysisDynamicFormALE from 'pages/MetaAnalysis/components/MetaAnalysisDynamicFormALE';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;
export const isALE = (correctorOrEstimatorLabel: string) => correctorOrEstimatorLabel === 'ALE';

interface IDynamicForm {
    type: EAnalysisType | 'CORRECTOR';
    correctorOrEstimatorLabel: string;
    values: IDynamicValueType;
    onUpdate: (arg: IDynamicValueType) => void;
}

const MetaAnalysisDynamicForm = (props: IDynamicForm) => {
    const parametersForGivenTypeAndLabel =
        metaAnalysisSpecification[props.type][props.correctorOrEstimatorLabel].parameters;
    const sortedParameterKeys = Object.keys(parametersForGivenTypeAndLabel).sort();

    const kwargStringIndex = sortedParameterKeys.findIndex((spec) => spec === KWARG_STRING);
    if (kwargStringIndex >= 0) {
        sortedParameterKeys.splice(kwargStringIndex, 1);
        sortedParameterKeys.push(KWARG_STRING);
    }

    const hasFwhmValue = props.values['kernel__fwhm'] != null && props.values['kernel__fwhm'] !== '';
    const hasSampleSizeValue =
        props.values['kernel__sample_size'] != null && props.values['kernel__sample_size'] !== '';

    const parametersAsInputList: IDynamicFormInput[] = sortedParameterKeys.map((parameterKey) => {
        const parameter =
            metaAnalysisSpecification[props.type][props.correctorOrEstimatorLabel].parameters[parameterKey];
        const isFwhmOrSampleSize = parameterKey === 'kernel__fwhm' || parameterKey === 'kernel__sample_size';
        const disabled = isFwhmOrSampleSize && (parameterKey === 'kernel__fwhm' ? hasSampleSizeValue : hasFwhmValue);

        return {
            parameterName: parameterKey,
            parameter: parameter,
            value: props.values[parameterKey],
            onUpdate: props.onUpdate,
            disabled,
        };
    });

    if (isALE(props.correctorOrEstimatorLabel)) {
        return (
            <MetaAnalysisDynamicFormALE
                parametersAsInputList={parametersAsInputList}
                onUpdate={props.onUpdate}
                correctorOrEstimatorLabel={props.correctorOrEstimatorLabel}
            />
        );
    }

    return (
        <Box>
            {parametersAsInputList.length > 0 &&
                parametersAsInputList.map((parameterAsInput) => {
                    const DynamicInputComponent = getDynamicFormInputComponentByParameter(parameterAsInput.parameter);
                    return <DynamicInputComponent key={parameterAsInput.parameterName} {...parameterAsInput} />;
                })}
            {parametersAsInputList.length === 0 && <Box sx={{ color: 'warning.dark' }}>No arguments available</Box>}
        </Box>
    );
};

export default MetaAnalysisDynamicForm;
