import {
    Alert,
    Box,
    Button,
    Checkbox,
    Divider,
    FormControlLabel,
    Link,
    List,
    ListItem,
    Typography,
} from '@mui/material';
import { IDynamicFormInput, IDynamicValueType } from 'pages/MetaAnalysis/components/DynamicForm.types';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useProjectId } from 'stores/projects/ProjectStore';
import useStudiesWithMissingSampleSizeALE from 'pages/MetaAnalysis/hooks/useALEMissingSampleSize';
import { getDynamicFormInputComponentByParameter } from 'pages/MetaAnalysis/components/DynamicForm.helpers';
import DynamicFormKwargInput from 'pages/MetaAnalysis/components/DynamicFormKwargInput';
import DynamicFormStyles from 'pages/MetaAnalysis/components/DynamicFormStyles';
import MetaAnalysisDynamicFormTitle from 'pages/MetaAnalysis/components/MetaAnalysisDynamicFormTitle';

const KERNEL_PARAMS = new Set(['kernel__fwhm', 'kernel__sample_size']);
const KERNEL_UNAVAILABLE_WHEN_USING_STUDY_SAMPLE_SIZE =
    'This input can only be used when Use Study/Analysis Specific Sample Sizes is not selected';
const KERNEL_UNAVAILABLE_WHEN_FWHM_SET =
    'This input is mutually exclusive with fwhm and cannot be used when fwhm is set. Remove the value from fwhm to set this input';
const KERNEL_UNAVAILABLE_WHEN_SAMPLE_SIZE_SET =
    'This input is mutually exclusive with sample_size and cannot be used when sample_size is set. Remove the value from sample_size to set this input';

const hasParameterValue = (value: unknown) => value != null && value !== '';

const getKernelUnavailableMessage = (
    parameterName: string,
    isUsingSampleSize: boolean,
    hasFwhmValue: boolean,
    hasSampleSizeValue: boolean
): string | null => {
    if (!KERNEL_PARAMS.has(parameterName)) {
        return null;
    }
    if (isUsingSampleSize) {
        return KERNEL_UNAVAILABLE_WHEN_USING_STUDY_SAMPLE_SIZE;
    }
    if (parameterName === 'kernel__fwhm' && hasSampleSizeValue) {
        return KERNEL_UNAVAILABLE_WHEN_SAMPLE_SIZE_SET;
    }
    if (parameterName === 'kernel__sample_size' && hasFwhmValue) {
        return KERNEL_UNAVAILABLE_WHEN_FWHM_SET;
    }
    return null;
};

interface IMetaAnalysisDynamicFormALE {
    parametersAsInputList: IDynamicFormInput[];
    onUpdate: (arg: IDynamicValueType) => void;
    correctorOrEstimatorLabel: string;
}

const MetaAnalysisDynamicFormALE = (props: IMetaAnalysisDynamicFormALE) => {
    const [isUsingSampleSize, setIsUsingSampleSize] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const studiesMissingSampleSize = useStudiesWithMissingSampleSizeALE(props.correctorOrEstimatorLabel);
    const projectId = useProjectId();
    const hasFwhmValue = hasParameterValue(
        props.parametersAsInputList.find((p) => p.parameterName === 'kernel__fwhm')?.value
    );
    const hasSampleSizeValue = hasParameterValue(
        props.parametersAsInputList.find((p) => p.parameterName === 'kernel__sample_size')?.value
    );

    return (
        <Box>
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
                                    // Either we accept kernal__sample_size, kernal__fwhm, or NEITHER if we use sample size (from annotations or study metadata)
                                    const sampleSizeParameter = props.parametersAsInputList.find(
                                        (p) => p.parameterName === 'kernel__sample_size'
                                    );
                                    const fwhmParameter = props.parametersAsInputList.find(
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
                        <Typography sx={{ fontWeight: 'bold' }}>Use Study/Analysis Specific Sample Sizes</Typography>
                    }
                />
                <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                    When enabled, values for sample_size will be used from annotations. If sample_size is not found in
                    annotations, then values for sample_size will be used from study metadata. This option is mutually
                    exclusive with kernel__fwhm and kernel__sample_size.
                </Typography>
                {isUsingSampleSize && studiesMissingSampleSize.length > 0 && (
                    <Alert severity="error" sx={{ marginBottom: '1rem' }}>
                        <Typography variant="subtitle2" component="span" sx={{ fontWeight: 'bold' }}>
                            The following studies are missing sample sizes (missing both in annotations and in study
                            metadata). For each study listed below, add sample sizes either to annotations or to study
                            metadata to run with this option enabled:
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

            <Button
                onClick={() => setShowAdvancedSettings((prevState) => !prevState)}
                sx={{ marginBottom: '1rem' }}
                variant="text"
            >
                {showAdvancedSettings ? 'hide' : 'show'} advanced settings
            </Button>
            <Box sx={{ display: showAdvancedSettings ? 'block' : 'none' }}>
                <Divider sx={{ marginBottom: '1rem' }} />
                {props.parametersAsInputList.length > 0 &&
                    props.parametersAsInputList.map((parameterAsInput) => {
                        const kernelUnavailableMessage = getKernelUnavailableMessage(
                            parameterAsInput.parameterName,
                            isUsingSampleSize,
                            hasFwhmValue,
                            hasSampleSizeValue
                        );
                        if (kernelUnavailableMessage) {
                            return (
                                <Box key={parameterAsInput.parameterName} sx={DynamicFormStyles.input}>
                                    <MetaAnalysisDynamicFormTitle
                                        name={parameterAsInput.parameterName}
                                        description={parameterAsInput.parameter.description}
                                        disabled
                                    />
                                    <Alert severity="info">{kernelUnavailableMessage}</Alert>
                                </Box>
                            );
                        }

                        const DynamicInputComponent = getDynamicFormInputComponentByParameter(
                            parameterAsInput.parameter,
                            DynamicFormKwargInput
                        );
                        return <DynamicInputComponent key={parameterAsInput.parameterName} {...parameterAsInput} />;
                    })}
                {props.parametersAsInputList.length === 0 && (
                    <Box sx={{ color: 'warning.dark' }}>No arguments available</Box>
                )}
            </Box>
        </Box>
    );
};

export default MetaAnalysisDynamicFormALE;
