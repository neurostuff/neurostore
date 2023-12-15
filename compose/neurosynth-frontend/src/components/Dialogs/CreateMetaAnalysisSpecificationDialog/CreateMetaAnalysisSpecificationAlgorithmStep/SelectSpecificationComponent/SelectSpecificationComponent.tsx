import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import DynamicForm from 'components/MetaAnalysisConfigComponents/DynamicForm/DynamicForm';
import CreateMetaAnalysisSpecificationDialogBaseStyles from '../../CreateMetaAnalysisSpecificationDialogBase.styles';
import { useEffect, useMemo, useRef } from 'react';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const getDefaultValuesForTypeAndParameter = (
    type: EAnalysisType | 'CORRECTOR',
    parameterLabel: string | undefined
): IDynamicValueType => {
    if (type && parameterLabel) {
        const parameters = metaAnalysisSpecification[type][parameterLabel].parameters;
        const defaultVals: IDynamicValueType = {};
        for (const [key, value] of Object.entries(parameters)) {
            if (parameters[key].type === null) {
                // in the case of kwargs or any other input with no default value
                defaultVals[key] = {};
            } else {
                defaultVals[key] = value.default;
            }
        }

        return defaultVals;
    }

    return {};
};

const SelectSpecificationComponent: React.FC<{
    onSelectSpecification: (algorithm: {
        estimator: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        corrector: IAutocompleteObject | null;
        correctorArgs: IDynamicValueType;
    }) => void;
    algorithm: {
        estimator: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        corrector: IAutocompleteObject | null;
        correctorArgs: IDynamicValueType;
    };
}> = (props) => {
    const initialized = useRef<boolean>(false);

    const metaAnalyticAlgorithms: IAutocompleteObject[] = useMemo(
        () =>
            Object.keys(metaAnalysisSpecification[EAnalysisType.CBMA]).map((algoName) => ({
                label: algoName,
                description: metaAnalysisSpecification[EAnalysisType.CBMA][algoName]?.summary || '',
            })),
        []
    );

    useEffect(() => {
        if (props.algorithm?.estimator || initialized.current) return;

        const algorithmOpt = metaAnalyticAlgorithms.find((algo) => algo.label === 'MKDADensity');
        if (!algorithmOpt) return;
        props.onSelectSpecification({
            ...props.algorithm,
            estimator: algorithmOpt,
            estimatorArgs: getDefaultValuesForTypeAndParameter(
                EAnalysisType.CBMA,
                algorithmOpt?.label
            ),
        });
        initialized.current = true;
    }, [props.algorithm?.estimator, metaAnalyticAlgorithms, props]);

    const correctorOptions: IAutocompleteObject[] = useMemo(
        () =>
            Object.keys(metaAnalysisSpecification.CORRECTOR).map((corrector) => ({
                label: corrector,
                description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
            })),
        []
    );

    return (
        <Box>
            <Typography sx={{ margin: '1rem 0' }} gutterBottom>
                Select the <b>algorithm</b> that you would like to use for your meta-analysis
            </Typography>

            <Box sx={CreateMetaAnalysisSpecificationDialogBaseStyles.highlightInput}>
                <NeurosynthAutocomplete
                    size="medium"
                    label="algorithm"
                    isOptionEqualToValue={(option, value) => option?.label === value?.label}
                    renderOption={(params, option) => (
                        <ListItem {...params}>
                            <ListItemText
                                primary={option?.label || ''}
                                secondary={option?.description || ''}
                            />
                        </ListItem>
                    )}
                    value={props.algorithm?.estimator}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        props.onSelectSpecification({
                            ...props.algorithm,
                            estimator: newVal,
                            estimatorArgs: getDefaultValuesForTypeAndParameter(
                                EAnalysisType.CBMA,
                                newVal?.label
                            ),
                        });
                    }}
                    options={metaAnalyticAlgorithms}
                />

                {props.algorithm?.estimator && (
                    <Box sx={{ margin: '1rem 0' }}>
                        <NeurosynthAccordion
                            elevation={0}
                            expandIconColor={'secondary.main'}
                            sx={{
                                border: '2px solid',
                                borderColor: 'secondary.main',
                            }}
                            accordionSummarySx={{
                                ':hover': {
                                    backgroundColor: '#f2f2f2',
                                },
                            }}
                            TitleElement={
                                <Typography sx={{ color: 'secondary.main' }}>
                                    Algorithm arguments
                                </Typography>
                            }
                        >
                            <DynamicForm
                                onUpdate={(arg) => {
                                    props.onSelectSpecification({
                                        ...props.algorithm,
                                        estimatorArgs: {
                                            ...props.algorithm.estimatorArgs,
                                            ...arg,
                                        },
                                    });
                                }}
                                type={EAnalysisType.CBMA}
                                correctorOrEstimatorLabel={props.algorithm.estimator.label}
                                values={props.algorithm.estimatorArgs}
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>

            <Typography sx={{ margin: '1rem 0' }} gutterBottom>
                [Optional] Select the <b>corrector</b> that you would like to use for your
                meta-analysis
            </Typography>

            <Box sx={CreateMetaAnalysisSpecificationDialogBaseStyles.highlightInput}>
                <NeurosynthAutocomplete
                    size="medium"
                    label="corrector (optional)"
                    required={false}
                    isOptionEqualToValue={(option, value) => option?.label === value?.label}
                    renderOption={(params, option) => (
                        <ListItem {...params}>
                            <ListItemText
                                primary={option?.label || ''}
                                secondary={option?.description || ''}
                            />
                        </ListItem>
                    )}
                    value={props.algorithm?.corrector}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        props.onSelectSpecification({
                            ...props.algorithm,
                            corrector: newVal,
                            correctorArgs: getDefaultValuesForTypeAndParameter(
                                'CORRECTOR',
                                newVal?.label
                            ),
                        });
                    }}
                    options={correctorOptions}
                />

                {props.algorithm?.corrector && (
                    <Box sx={{ margin: '1rem 0' }}>
                        <NeurosynthAccordion
                            elevation={0}
                            expandIconColor={'secondary.main'}
                            sx={{
                                border: '2px solid',
                                borderColor: 'secondary.main',
                            }}
                            accordionSummarySx={{
                                ':hover': {
                                    backgroundColor: '#f2f2f2',
                                },
                            }}
                            TitleElement={
                                <Typography sx={{ color: 'secondary.main' }}>
                                    Corrector arguments
                                </Typography>
                            }
                        >
                            <DynamicForm
                                onUpdate={(arg) => {
                                    props.onSelectSpecification({
                                        ...props.algorithm,
                                        correctorArgs: {
                                            ...props.algorithm.correctorArgs,
                                            ...arg,
                                        },
                                    });
                                }}
                                type="CORRECTOR"
                                correctorOrEstimatorLabel={props.algorithm.corrector.label}
                                values={props.algorithm.correctorArgs}
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default SelectSpecificationComponent;
