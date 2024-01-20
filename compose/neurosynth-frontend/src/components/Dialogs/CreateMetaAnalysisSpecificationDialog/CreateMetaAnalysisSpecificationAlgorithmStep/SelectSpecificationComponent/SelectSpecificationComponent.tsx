import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import DynamicForm from 'components/MetaAnalysisConfigComponents/DynamicForm/DynamicForm';
import CreateMetaAnalysisSpecificationDialogBaseStyles from '../../CreateMetaAnalysisSpecificationDialogBase.styles';
import {
    getDefaultValuesForTypeAndParameter,
    metaAnalyticAlgorithms,
    correctorOptions,
} from '../../CreateMetaAnalysisSpecificationDialogConstants';

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
                        // Create a new algorithm object with the updated estimator
                        const updatedAlgorithm = {
                            ...props.algorithm,
                            estimator: newVal,
                            estimatorArgs: getDefaultValuesForTypeAndParameter(
                                EAnalysisType.CBMA,
                                newVal?.label
                            ),
                        };
                        props.onSelectSpecification(updatedAlgorithm);

                        // Trigger update for the corrector
                        const newCorrectorArgs = getDefaultValuesForTypeAndParameter(
                            'CORRECTOR',
                            props.algorithm?.corrector?.label,
                            newVal?.label,
                            EAnalysisType.CBMA
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
                                newVal?.label,
                                props.algorithm.estimator?.label,
                                EAnalysisType.CBMA
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
