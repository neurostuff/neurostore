import { Box, ListItem, ListItemText, Typography, Divider } from '@mui/material';
import { IDynamicInputType, IMetaAnalysisAlgorithm, IMetaAnalysisParamsSpecification } from '..';
import { NavigationButtons, NeurosynthAccordion } from '../..';
import metaAnalysisSpec from '../../../assets/config/meta_analysis_params.json';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import NeurosynthAutocomplete, {
    IAutocompleteObject,
} from '../../NeurosynthAutocomplete/NeurosynthAutocomplete';
import DynamicForm from './DynamicForm/DynamicForm';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const MetaAnalysisAlgorithm: React.FC<IMetaAnalysisAlgorithm> = (props) => {
    const getMetaAnalyticAlgorithms: IAutocompleteObject[] = Object.keys(
        metaAnalysisSpecification[props.metaAnalysisType]
    ).map((algoName) => ({
        label: algoName,
        description: metaAnalysisSpecification[props.metaAnalysisType][algoName]?.summary || '',
    }));

    const getCorrectorOptions: IAutocompleteObject[] = Object.keys(
        metaAnalysisSpecification.CORRECTOR
    ).map((corrector) => ({
        label: corrector,
        description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
    }));

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

    return (
        <>
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
                            <ListItemText primary={option.label} secondary={option.description} />
                        </ListItem>
                    )}
                    value={props.estimator || null}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        props.onUpdate({ estimator: newVal });
                        props.onArgsUpdate({
                            estimatorArgs: getArgsForKey(props.metaAnalysisType, newVal),
                        });
                    }}
                    options={getMetaAnalyticAlgorithms}
                />

                {props.estimator && (
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
                                    props.onArgsUpdate({
                                        estimatorArgs: { ...arg },
                                    });
                                }}
                                values={props.estimatorArgs}
                                specification={
                                    metaAnalysisSpecification[props.metaAnalysisType][
                                        props.estimator.label
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
                            <ListItemText primary={option.label} secondary={option.description} />
                        </ListItem>
                    )}
                    value={props.corrector || null}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newVal, _reason) => {
                        props.onUpdate({
                            corrector: newVal,
                        });
                        props.onArgsUpdate({ correctorArgs: getArgsForKey('CORRECTOR', newVal) });
                    }}
                    options={getCorrectorOptions}
                />

                {props.corrector && (
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
                                    props.onArgsUpdate({
                                        correctorArgs: { ...arg },
                                    });
                                }}
                                values={props.correctorArgs}
                                specification={
                                    metaAnalysisSpecification.CORRECTOR[props.corrector.label]
                                        .parameters
                                }
                            />
                        </NeurosynthAccordion>
                    </Box>
                )}
            </Box>
            <NavigationButtons
                nextButtonDisabled={props.estimator === undefined || props.estimator === null}
                onButtonClick={props.onNext}
                nextButtonStyle="outlined"
            />
        </>
    );
};

export default MetaAnalysisAlgorithm;
