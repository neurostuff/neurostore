import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import MetaAnalysisDynamicForm from 'pages/MetaAnalysis/components/MetaAnalysisDynamicForm';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import { IAlgorithmSelection } from './CreateMetaAnalysisSpecificationDialogBase.types';
import {
    getDefaultValuesForAlgorithm,
    getDefaultValuesForCorrector,
    getMetaAnalyticAlgorithms,
    getMetaAnalyticCorrectors,
} from './CreateMetaAnalysisSpecificationDialog.helpers';

const SelectSpecificationComponent = (props: {
    onSelectSpecification: (algorithm: IAlgorithmSelection) => void;
    algorithm: IAlgorithmSelection;
}) => {
    const analysisType = useProjectAnalysisType() ?? EAnalysisType.CBMA;
    const metaAnalyticAlgorithms = getMetaAnalyticAlgorithms(analysisType);
    const metaAnalyticCorrectors = getMetaAnalyticCorrectors(analysisType);

    return (
        <Box>
            <Box sx={{ marginBottom: '3rem' }}>
                <Typography sx={{ margin: '1rem 0' }} gutterBottom>
                    Select the <b>algorithm</b> that you would like to use for your meta-analysis
                </Typography>

                <NeurosynthAutocomplete
                    size="medium"
                    label="algorithm"
                    isOptionEqualToValue={(option, value) => option?.label === value?.label}
                    renderOption={(params, option) => (
                        <ListItem {...params}>
                            <ListItemText primary={option?.label || ''} secondary={option?.description || ''} />
                        </ListItem>
                    )}
                    value={props.algorithm?.estimator}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        // Create a new algorithm object with the updated estimator
                        const updatedAlgorithm = {
                            ...props.algorithm,
                            estimator: newVal,
                            estimatorArgs: getDefaultValuesForAlgorithm(analysisType, newVal?.label),
                        };
                        props.onSelectSpecification(updatedAlgorithm);

                        // Trigger update for the corrector
                        const newCorrectorArgs = getDefaultValuesForCorrector(
                            analysisType,
                            props.algorithm?.corrector?.label,
                            newVal?.label
                        );

                        // Update the corrector in the algorithm object
                        updatedAlgorithm.correctorArgs = newCorrectorArgs;

                        props.onSelectSpecification(updatedAlgorithm);
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
                            TitleElement={<Typography sx={{ color: 'secondary.main' }}>Algorithm arguments</Typography>}
                        >
                            <MetaAnalysisDynamicForm
                                onUpdate={(arg) => {
                                    props.onSelectSpecification({
                                        ...props.algorithm,
                                        estimatorArgs: {
                                            ...props.algorithm.estimatorArgs,
                                            ...arg,
                                        },
                                    });
                                }}
                                type={analysisType}
                                correctorOrEstimatorLabel={props.algorithm.estimator.label}
                                values={props.algorithm.estimatorArgs}
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>

            <Box sx={{ margin: '3rem 0' }}>
                <Typography sx={{ margin: '1rem 0' }} gutterBottom>
                    [Optional] Select the <b>corrector</b> that you would like to use for your meta-analysis
                </Typography>

                <Box>
                    <NeurosynthAutocomplete
                        size="medium"
                        label="corrector (optional)"
                        required={false}
                        isOptionEqualToValue={(option, value) => option?.label === value?.label}
                        renderOption={(params, option) => (
                            <ListItem {...params}>
                                <ListItemText primary={option?.label || ''} secondary={option?.description || ''} />
                            </ListItem>
                        )}
                        value={props.algorithm?.corrector}
                        getOptionLabel={(option) => option?.label || ''}
                        onChange={(_event, newVal, _reason) => {
                            props.onSelectSpecification({
                                ...props.algorithm,
                                corrector: newVal,
                                correctorArgs: getDefaultValuesForCorrector(
                                    analysisType,
                                    newVal?.label,
                                    props.algorithm.estimator?.label
                                ),
                            });
                        }}
                        options={metaAnalyticCorrectors}
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
                                    <Typography sx={{ color: 'secondary.main' }}>Corrector arguments</Typography>
                                }
                            >
                                <MetaAnalysisDynamicForm
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
        </Box>
    );
};

export default SelectSpecificationComponent;
