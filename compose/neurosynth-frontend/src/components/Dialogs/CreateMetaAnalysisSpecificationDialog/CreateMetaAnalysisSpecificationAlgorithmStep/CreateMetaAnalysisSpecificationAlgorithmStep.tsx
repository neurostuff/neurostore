import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import EditAnalysesStyles from 'components/EditStudyComponents/EditAnalyses/EditAnalyses.styles';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import DynamicForm from 'components/MetaAnalysisConfigComponents/DynamicForm/DynamicForm';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { EAnalysisType } from 'hooks/requests/useCreateAlgorithmSpecification';
import { useState } from 'react';

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

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const CreateMetaAnalysisSpecificationAlgorithmStep: React.FC<{
    onChooseAlgorithm: (
        estimator: IAutocompleteObject,
        estimatorArgs: IDynamicValueType,
        corrector: IAutocompleteObject | null,
        correctorArgs: IDynamicValueType
    ) => void;
    algorithm: {
        estimator: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        corrector: IAutocompleteObject | null;
        correctorArgs: IDynamicValueType;
    };
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const [algorithmSpec, setAlgorithmSpec] = useState<{
        estimator: IAutocompleteObject | null;
        corrector: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        correctorArgs: IDynamicValueType;
    }>(props.algorithm);

    const handleNavigate = (button: ENavigationButton) => {
        if (button === ENavigationButton.NEXT && algorithmSpec.estimator?.label) {
            props.onChooseAlgorithm(
                algorithmSpec.estimator,
                algorithmSpec.estimatorArgs,
                algorithmSpec.corrector,
                algorithmSpec.correctorArgs
            );
        }
        props.onNavigate(button);
    };

    const getMetaAnalyticAlgorithms: IAutocompleteObject[] = Object.keys(
        metaAnalysisSpecification[EAnalysisType.CBMA]
    ).map((algoName) => ({
        label: algoName,
        description: metaAnalysisSpecification[EAnalysisType.CBMA][algoName]?.summary || '',
    }));

    const getCorrectorOptions: IAutocompleteObject[] = Object.keys(
        metaAnalysisSpecification.CORRECTOR
    ).map((corrector) => ({
        label: corrector,
        description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
    }));

    return (
        <Box>
            <Box sx={{ marginBottom: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem' }}>
                    Select the <b>algorithm</b> that you would like to use for your meta-analysis
                </Typography>

                <NeurosynthAutocomplete
                    size="medium"
                    sx={{ marginBottom: '1rem' }}
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
                    value={algorithmSpec?.estimator}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        setAlgorithmSpec((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      estimator: newVal,
                                      estimatorArgs: getDefaultValuesForTypeAndParameter(
                                          EAnalysisType.CBMA,
                                          newVal?.label
                                      ),
                                  }
                                : prev
                        );
                    }}
                    options={getMetaAnalyticAlgorithms}
                />

                {algorithmSpec?.estimator && (
                    <Box sx={{ margin: '2rem 0' }}>
                        <NeurosynthAccordion
                            elevation={0}
                            accordionSummarySx={EditAnalysesStyles.accordionSummary}
                            TitleElement={<Typography>Algorithm arguments</Typography>}
                        >
                            <DynamicForm
                                onUpdate={(arg) => {
                                    setAlgorithmSpec((prev) => {
                                        return {
                                            ...prev,
                                            estimatorArgs: {
                                                ...prev.estimatorArgs,
                                                ...arg,
                                            },
                                        };
                                    });
                                }}
                                type={EAnalysisType.CBMA}
                                correctorOrEstimatorLabel={algorithmSpec.estimator.label}
                                values={algorithmSpec.estimatorArgs}
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}

                <Typography sx={{ marginBottom: '1rem' }}>
                    Select the <b>corrector</b> that you would like to use for your meta-analysis
                </Typography>

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
                    value={algorithmSpec?.corrector}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        setAlgorithmSpec((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      corrector: newVal,
                                      correctorArgs: getDefaultValuesForTypeAndParameter(
                                          'CORRECTOR',
                                          newVal?.label
                                      ),
                                  }
                                : prev
                        );
                    }}
                    options={getCorrectorOptions}
                />

                {algorithmSpec?.corrector && (
                    <Box sx={{ margin: '2rem 0' }}>
                        <NeurosynthAccordion
                            elevation={0}
                            accordionSummarySx={EditAnalysesStyles.accordionSummary}
                            TitleElement={<Typography>Corrector arguments</Typography>}
                        >
                            <DynamicForm
                                onUpdate={(arg) => {
                                    setAlgorithmSpec((prev) => {
                                        return {
                                            ...prev,
                                            correctorArgs: {
                                                ...prev.correctorArgs,
                                                ...arg,
                                            },
                                        };
                                    });
                                }}
                                type="CORRECTOR"
                                correctorOrEstimatorLabel={algorithmSpec.corrector.label}
                                values={algorithmSpec.correctorArgs}
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>
            <Box sx={{ width: '100$%' }}>
                <NavigationButtons
                    nextButtonDisabled={!algorithmSpec.estimator}
                    nextButtonStyle="contained"
                    onButtonClick={handleNavigate}
                />
            </Box>
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationAlgorithmStep;
