import { Box, Button, Divider, ListItem, ListItemText, Typography } from '@mui/material';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import BaseDialog, { IDialog } from '../BaseDialog';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { EAnalysisType } from 'legacy/MetaAnalysis/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import DynamicForm from 'components/MetaAnalysisConfigComponents/MetaAnalysisAlgorithm/DynamicForm/DynamicForm';
import { useState } from 'react';
import EditAnalysesStyles from 'components/EditStudyComponents/EditAnalyses/EditAnalyses.styles';

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

const AlgorithmDialog: React.FC<IDialog> = (props) => {
    const handleSelectAlgorithm = () => {};

    const [algorithmSpec, setAlgorithmSpec] = useState<{
        estimator: IAutocompleteObject | undefined | null;
        corrector: IAutocompleteObject | undefined | null;
        estimatorArgs: IDynamicValueType;
        correctorArgs: IDynamicValueType;
    }>({
        estimator: undefined,
        corrector: undefined,
        estimatorArgs: {},
        correctorArgs: {},
    });

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
        <BaseDialog
            isOpen={props.isOpen}
            onCloseDialog={props.onCloseDialog}
            maxWidth="md"
            fullWidth
            dialogTitle="Select Algorithm and Relevant options"
        >
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
                            TitleElement={<Typography>Optional algorithm arguments</Typography>}
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
                            TitleElement={<Typography>Optional algorithm arguments</Typography>}
                        >
                            <Divider sx={{ marginBottom: '1rem' }} />
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    sx={{ marginRight: '15px' }}
                    onClick={handleSelectAlgorithm}
                    disabled={!algorithmSpec?.estimator}
                    variant="contained"
                >
                    save
                </Button>
                <Button variant="contained" color="success">
                    save and run your meta-analysis
                </Button>
            </Box>
        </BaseDialog>
    );
};

export default AlgorithmDialog;
