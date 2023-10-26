import { Box } from '@mui/material';
import {
    IDynamicFormInput,
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
    IParameter,
    KWARG_STRING,
} from 'components/MetaAnalysisConfigComponents/index';
import DynamicFormBoolInput from './DynamicFormBoolInput';
import DynamicFormKwargInput from './DynamicFormKwargInput';
import DynamicFormNumericInput from './DynamicFormNumericInput';
import DynamicFormSelectInput from './DynamicFormSelectInput';
import DynamicFormStringInput from './DynamicFormStringInput';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { EAnalysisType } from 'hooks/requests/useCreateAlgorithmSpecification';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const getDynamicFormInputComponentByParameter = (
    parameter: IParameter
): React.FC<IDynamicFormInput> => {
    switch (parameter.type) {
        case 'str':
            return DynamicFormStringInput;
        case 'int':
        case 'float':
            return DynamicFormNumericInput;
        case 'bool':
            return DynamicFormBoolInput;
        case null:
            return DynamicFormKwargInput;
        default:
            return DynamicFormSelectInput;
    }
};

interface IDynamicForm {
    type: EAnalysisType | 'CORRECTOR';
    correctorOrEstimatorLabel: string;
    values: IDynamicValueType;
    onUpdate: (arg: IDynamicValueType) => void;
}

const DynamicForm: React.FC<IDynamicForm> = (props) => {
    const parametersForGivenTypeAndLabel =
        metaAnalysisSpecification[props.type][props.correctorOrEstimatorLabel].parameters;
    const sortedParameterKeys = Object.keys(parametersForGivenTypeAndLabel).sort();

    const kwargStringIndex = sortedParameterKeys.findIndex((spec) => spec === KWARG_STRING);
    if (kwargStringIndex >= 0) {
        sortedParameterKeys.splice(kwargStringIndex, 1);
        sortedParameterKeys.push(KWARG_STRING);
    }

    const parametersAsInputList: IDynamicFormInput[] = sortedParameterKeys.map((parameterKey) => {
        const parameter =
            metaAnalysisSpecification[props.type][props.correctorOrEstimatorLabel].parameters[
                parameterKey
            ];

        return {
            parameterName: parameterKey,
            parameter: parameter,
            value: props.values[parameterKey],
            onUpdate: props.onUpdate,
        };
    });

    return (
        <Box
            sx={{
                maxHeight: {
                    xs: '200px',
                    md: '350px',
                },
                overflowY: 'auto',
            }}
        >
            {parametersAsInputList.length > 0 &&
                parametersAsInputList.map((parameterAsInput) => {
                    const DynamicInputComponent = getDynamicFormInputComponentByParameter(
                        parameterAsInput.parameter
                    );
                    return (
                        <Box key={parameterAsInput.parameterName}>
                            <DynamicInputComponent {...parameterAsInput} />
                        </Box>
                    );
                })}
            {parametersAsInputList.length === 0 && (
                <Box sx={{ color: 'warning.dark' }}>No arguments available</Box>
            )}
        </Box>
    );
};

export default DynamicForm;
