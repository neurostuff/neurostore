import { Box, Button, Divider, ListItem, ListItemText, Typography } from '@mui/material';
import {
    IDynamicInputType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import BaseDialog, { IDialog } from '../BaseDialog';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import {
    EAnalysisType,
    IEstimatorCorrectorArgs,
} from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import DynamicForm from 'components/MetaAnalysisConfigComponents/MetaAnalysisAlgorithm/DynamicForm/DynamicForm';
import { useState } from 'react';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import useUpdateProject from 'hooks/requests/useUpdateProject';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

/**
 * Helper function that gets the inputs for the selected algorithm and sets their default values
 * based on the meta_analysis_params file
 */
const getArgsForKey = (
    type: EAnalysisType | 'CORRECTOR',
    parameterName: IAutocompleteObject | null | undefined
): IDynamicInputType => {
    if (parameterName?.label) {
        const params = metaAnalysisSpecification[type][parameterName.label]?.parameters;
        const args: IDynamicInputType = {};
        for (const [key, value] of Object.entries(params)) {
            // if we have a kwarg argument
            args[key] = value?.type === null ? {} : value.default;
        }
        return args;
    }
    return {};
};

const AlgorithmDialog: React.FC<IDialog> = (props) => {
    const { mutate } = useUpdateProject();

    const handleSetAlgorithm = () => {};

    const [algorithmSpec, setAlgorithmSpec] = useState<{
        estimator: IAutocompleteObject | undefined | null;
        corrector: IAutocompleteObject | undefined | null;
    }>({
        estimator: undefined,
        corrector: undefined,
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
                    sx={{ width: '50%', marginBottom: '1rem' }}
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
                                  }
                                : prev
                        );
                    }}
                    options={getMetaAnalyticAlgorithms}
                />

                {algorithmSpec?.estimator && (
                    <Box sx={{ margin: '2rem 0' }}>
                        <NeurosynthAccordion
                            elevation={2}
                            TitleElement={
                                <Typography variant="subtitle1">
                                    Optional algorithm arguments
                                </Typography>
                            }
                        >
                            <Divider sx={{ marginBottom: '1rem' }} />
                            <DynamicForm
                                onUpdate={(arg) => {
                                    // props.onArgsUpdate({
                                    //     estimatorArgs: { ...arg },
                                    // });
                                }}
                                values={getArgsForKey(EAnalysisType.CBMA, algorithmSpec?.estimator)}
                                specification={
                                    metaAnalysisSpecification[EAnalysisType.CBMA][
                                        algorithmSpec?.estimator.label
                                    ].parameters
                                }
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}

                <Typography sx={{ marginBottom: '1rem' }}>
                    Select the <b>corrector</b> that you would like to use for your meta-analysis
                </Typography>

                <NeurosynthAutocomplete
                    sx={{ width: '50%' }}
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
                                  }
                                : prev
                        );
                    }}
                    options={getCorrectorOptions}
                />

                {algorithmSpec?.corrector && (
                    <Box sx={{ margin: '2rem 0' }}>
                        <NeurosynthAccordion
                            elevation={2}
                            TitleElement={
                                <Typography variant="subtitle1">
                                    Optional corrector arguments
                                </Typography>
                            }
                        >
                            <Divider sx={{ marginBottom: '1rem' }} />
                            <DynamicForm
                                onUpdate={(arg) => {
                                    // props.onArgsUpdate({
                                    //     correctorArgs: { ...arg },
                                    // });
                                }}
                                values={getArgsForKey('CORRECTOR', algorithmSpec?.corrector)}
                                specification={
                                    metaAnalysisSpecification.CORRECTOR[
                                        algorithmSpec?.corrector.label
                                    ].parameters
                                }
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>
            <Button
                disabled={!algorithmSpec?.corrector || !algorithmSpec?.estimator}
                variant="contained"
            >
                set algorithm
            </Button>
        </BaseDialog>
    );
};

export default AlgorithmDialog;
