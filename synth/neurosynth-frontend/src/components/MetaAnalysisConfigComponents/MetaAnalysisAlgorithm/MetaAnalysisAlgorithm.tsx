import {
    Box,
    FormControl,
    InputLabel,
    Select,
    ListItem,
    ListItemText,
    Autocomplete,
    TextField,
} from '@mui/material';
import { useState } from 'react';
import { NavigationButtons } from '../..';
import metaAnalysisSpec from '../../../assets/config/meta_analysis_params.json';
import { ENavigationButton } from '../../NavigationButtons/NavigationButtons';
import MetaAnalysisDataStyles from '../MetaAnalysisData/MetaAnalysisData.styles';
import DynamicForm from './DynamicForm/DynamicForm';

const MetaAnalysisAlgorithm: React.FC<{ onNext: (button: ENavigationButton) => void }> = (
    props
) => {
    const [selectedAlgorithm, setSelectedAlgorithm] =
        useState<{ label: string; description: string }>();

    const metaAnalyticAlgorithms = Object.keys(metaAnalysisSpec.CBMA).map((algo) => ({
        label: algo,
        description: (metaAnalysisSpec.CBMA as any)[algo].summary || '',
    }));

    return (
        <>
            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>algorithm</b> that you would like to use for your meta analysis
            </Box>
            <Autocomplete
                isOptionEqualToValue={(option, value) => option.label === value.label}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.label} secondary={option.description} />
                    </ListItem>
                )}
                sx={[{ marginBottom: '2rem' }, MetaAnalysisDataStyles.selectInput]}
                renderInput={(params) => <TextField {...params} label="algorithm" />}
                value={selectedAlgorithm || null}
                getOptionLabel={(option) => option?.label || ''}
                onChange={(_event, newVal, _reason) => {
                    if (newVal) setSelectedAlgorithm(newVal);
                }}
                options={metaAnalyticAlgorithms}
            />

            {selectedAlgorithm && (
                <DynamicForm
                    specification={
                        (metaAnalysisSpec.CBMA as any)[selectedAlgorithm.label].parameters
                    }
                />
            )}

            <NavigationButtons
                nextButtonDisabled={selectedAlgorithm === undefined}
                onButtonClick={(event) => props.onNext(event)}
                nextButtonStyle="contained"
            />
        </>
    );
};

export default MetaAnalysisAlgorithm;
