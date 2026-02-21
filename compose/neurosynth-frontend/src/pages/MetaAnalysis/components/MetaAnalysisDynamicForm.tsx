import { Alert, Box, Checkbox, FormControlLabel, Link, List, ListItem, Switch, Typography } from '@mui/material';
import {
    IDynamicFormInput,
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
    IParameter,
    KWARG_STRING,
} from 'pages/MetaAnalysis/components/DynamicForm.types';
import DynamicFormBoolInput from './DynamicFormBoolInput';
import DynamicFormKwargInput from './DynamicFormKwargInput';
import DynamicFormNumericInput from './DynamicFormNumericInput';
import DynamicFormSelectInput from './DynamicFormSelectInput';
import DynamicFormStringInput from './DynamicFormStringInput';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import DynamicFormStyles from './DynamicFormStyles';
import useStudiesWithMissingSampleSizeALE from '../hooks/useALEMissingSampleSize';
import { useProjectId } from 'pages/Project/store/ProjectStore';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;
export const isALE = (correctorOrEstimatorLabel: string) => correctorOrEstimatorLabel === 'ALE';

const getDynamicFormInputComponentByParameter = (parameter: IParameter): React.FC<IDynamicFormInput> => {
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

const MetaAnalysisDynamicForm: React.FC<IDynamicForm> = (props) => {
    const [isUsingSampleSize, setIsUsingSampleSize] = useState(false);
    const studiesMissingSampleSize = useStudiesWithMissingSampleSizeALE(props.correctorOrEstimatorLabel);
    const projectId = useProjectId();

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

    return (
        <Box>
            {isALE(props.correctorOrEstimatorLabel) && (
                <Box sx={[DynamicFormStyles.input, { marginBottom: '0px !important' }]}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isUsingSampleSize}
                                onChange={(_val, newVal: boolean) => {
                                    if (newVal) {
                                        props.onUpdate({
                                            kernel__sample_size: null,
                                            kernel__fwhm: null,
                                        });
                                    } else {
                                        const sampleSizeParameter = parametersAsInputList.find(
                                            (p) => p.parameterName === 'kernel__sample_size'
                                        );
                                        const fwhmParameter = parametersAsInputList.find(
                                            (p) => p.parameterName === 'kernel__fwhm'
                                        );
                                        props.onUpdate({
                                            kernel__sample_size: sampleSizeParameter?.parameter.default,
                                            kernel__fwhm: fwhmParameter?.parameter.default,
                                        });
                                    }
                                    setIsUsingSampleSize(newVal);
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontWeight: 'bold' }}>
                                Use Study/Analysis Specific Sample Sizes
                            </Typography>
                        }
                    />
                    <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                        When enabled, values for sample_size will be used from annotations. If sample_size is not found
                        in annotations, then values for sample_size will be used from study metadata. This option is
                        mutually exclusive with kernel__fwhm and kernel__sample_size.
                    </Typography>
                    {isUsingSampleSize && studiesMissingSampleSize.length > 0 && (
                        <Alert severity="error" sx={{ marginBottom: '1rem' }}>
                            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 'bold' }}>
                                The following studies are missing sample sizes (in annotations and in study metadata).
                                Add sample sizes to run with this option enabled:
                            </Typography>
                            <List dense disablePadding sx={{ listStyle: 'disc', pl: 2, mt: 0.5 }}>
                                {studiesMissingSampleSize.map((study) => (
                                    <ListItem key={study.studyId} disablePadding sx={{ display: 'list-item' }}>
                                        {projectId ? (
                                            <Link
                                                component={RouterLink}
                                                target="_blank"
                                                to={`/projects/${projectId}/extraction/studies/${study.studyId}/edit`}
                                                underline="hover"
                                            >
                                                {study.studyName ?? study.studyId}
                                            </Link>
                                        ) : (
                                            <Typography component="span">{study.studyName ?? study.studyId}</Typography>
                                        )}
                                    </ListItem>
                                ))}
                            </List>
                        </Alert>
                    )}

                    {isUsingSampleSize && studiesMissingSampleSize.length === 0 && (
                        <Alert severity="success" sx={{ marginBottom: '1rem' }}>
                            All studies in the studyset have sample size values.
                        </Alert>
                    )}
                </Box>
            )}

            {parametersAsInputList.length > 0 &&
                parametersAsInputList.map((parameterAsInput) => {
                    const DynamicInputComponent = getDynamicFormInputComponentByParameter(parameterAsInput.parameter);
                    const isSampleSizeParameter =
                        parameterAsInput.parameterName === 'kernel__fwhm' ||
                        parameterAsInput.parameterName === 'kernel__sample_size';
                    const shouldHide =
                        isALE(props.correctorOrEstimatorLabel) && isUsingSampleSize && isSampleSizeParameter;

                    if (shouldHide) {
                        return null;
                    }

                    return <DynamicInputComponent {...parameterAsInput} />;
                })}
            {parametersAsInputList.length === 0 && <Box sx={{ color: 'warning.dark' }}>No arguments available</Box>}
        </Box>
    );
};

export default MetaAnalysisDynamicForm;
