import {
    Box,
    ListItem,
    ListItemText,
    Autocomplete,
    TextField,
    FormControl,
    FormHelperText,
    Typography,
    Divider,
} from '@mui/material';
import { useState } from 'react';
import { NavigationButtons, NeurosynthAccordion } from '../..';
import metaAnalysisSpec from '../../../assets/config/meta_analysis_params.json';
import { useInputValidation } from '../../../hooks';
import { ENavigationButton } from '../../NavigationButtons/NavigationButtons';

import DynamicForm from './DynamicForm/DynamicForm';

interface IAutocompleteObj {
    label: string;
    description: string;
}

const validationFunc = (arg: IAutocompleteObj | undefined | null) => !!arg;

const MetaAnalysisAlgorithm: React.FC<{ onNext: (button: ENavigationButton) => void }> = (
    props
) => {
    const { handleOnFocus, handleChange, handleOnBlur, isValid } =
        useInputValidation<IAutocompleteObj>(validationFunc);

    const [selectedAlgorithm, setSelectedAlgorithm] = useState<IAutocompleteObj | null>();

    const [selectedCorrector, setSelectedCorrector] = useState<IAutocompleteObj | null>();

    const metaAnalyticAlgorithms = Object.keys(metaAnalysisSpec.CBMA).map((algo) => ({
        label: algo,
        description: (metaAnalysisSpec.CBMA as any)[algo].summary || '',
    }));

    const correctorOptions = Object.keys(metaAnalysisSpec.CORRECTOR).map((corrector) => ({
        label: corrector,
        description: (metaAnalysisSpec.CORRECTOR as any)[corrector].summary,
    }));

    return (
        <>
            <Box sx={{ marginBottom: '1rem' }}>
                <Box sx={{ marginBottom: '1rem' }}>
                    Select the <b>algorithm</b> that you would like to use for your meta analysis
                </Box>
                <FormControl sx={{ width: '50%' }}>
                    <Autocomplete
                        isOptionEqualToValue={(option, value) => option.label === value.label}
                        renderOption={(params, option) => (
                            <ListItem {...params}>
                                <ListItemText
                                    primary={option.label}
                                    secondary={option.description}
                                />
                            </ListItem>
                        )}
                        onFocus={handleOnFocus}
                        onBlur={handleOnBlur}
                        renderInput={(params) => (
                            <TextField error={!isValid} required {...params} label="algorithm" />
                        )}
                        value={selectedAlgorithm || null}
                        getOptionLabel={(option) => option?.label || ''}
                        onChange={(_event, newVal, _reason) => {
                            setSelectedAlgorithm(newVal);
                            handleChange(newVal);
                        }}
                        options={metaAnalyticAlgorithms}
                    />
                    {!isValid && (
                        <FormHelperText sx={{ color: 'error.main' }}>
                            this is required
                        </FormHelperText>
                    )}
                </FormControl>
            </Box>

            <Box sx={{ marginBottom: '1rem' }}>
                Select the <b>corrector</b> that you would like to use for your meta analysis
            </Box>
            <Autocomplete
                isOptionEqualToValue={(option, value) => option.label === value.label}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.label} secondary={option.description} />
                    </ListItem>
                )}
                sx={{ width: '50%' }}
                renderInput={(params) => <TextField {...params} label="corrector (optional)" />}
                value={selectedCorrector || null}
                getOptionLabel={(option) => option?.label || ''}
                onChange={(_event, newVal, _reason) => {
                    setSelectedCorrector(newVal);
                }}
                options={correctorOptions}
            />

            {selectedAlgorithm && (
                <Box sx={{ marginTop: '2rem' }}>
                    <NeurosynthAccordion
                        elevation={2}
                        TitleElement={
                            <Typography variant="subtitle1">Optional arguments</Typography>
                        }
                    >
                        <>
                            <Divider sx={{ marginBottom: '1rem' }} />
                            <DynamicForm
                                specification={
                                    (metaAnalysisSpec.CBMA as any)[selectedAlgorithm.label]
                                        .parameters
                                }
                            />
                        </>
                    </NeurosynthAccordion>
                </Box>
            )}

            <NavigationButtons
                nextButtonDisabled={selectedAlgorithm === undefined || selectedAlgorithm === null}
                onButtonClick={(event) => props.onNext(event)}
                nextButtonStyle="contained"
            />
        </>
    );
};

export default MetaAnalysisAlgorithm;
