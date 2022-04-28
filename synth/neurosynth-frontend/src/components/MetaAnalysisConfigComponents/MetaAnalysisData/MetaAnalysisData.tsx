import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    ListItemText,
    ListItem,
    FormHelperText,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { IMetaAnalysisData } from '..';
import { NavigationButtons } from '../..';
import { useInputValidation } from '../../../hooks';
import useIsMounted from '../../../hooks/useIsMounted';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import { EPropertyType } from '../../EditMetadata';
import NeurosynthAutocomplete from '../../NeurosynthAutocomplete/NeurosynthAutocomplete';
import MetaAnalysisDataStyles from './MetaAnalysisData.styles';

const validationFunc = (arg: EAnalysisType | undefined | null) => !!arg;

const MetaAnalysisData: React.FC<IMetaAnalysisData> = (props) => {
    const [annotations, setAnnotations] = useState<AnnotationsApiResponse[]>();
    const [metadataKeys, setMetadataKeys] = useState<string[]>();

    const { current } = useIsMounted();
    const { handleChange, handleOnBlur, handleOnFocus, isValid } = useInputValidation(
        props.analysisType,
        validationFunc
    );

    useEffect(() => {
        if (!props.studyset || !props.studyset.id) return;

        const getAnnotationsForStudyset = (id: string) => {
            API.NeurostoreServices.AnnotationsService.annotationsGet(id).then((res) => {
                if (current && res && res.data && res.data.results) {
                    setAnnotations(res.data.results as AnnotationsApiResponse[]);
                }
            });
        };

        getAnnotationsForStudyset(props.studyset.id);
    }, [current, props.studyset]);

    useEffect(() => {
        if (!props.annotation || !props.annotation.id) return;

        const keyTypes: string[] = [];
        for (const [key, value] of Object.entries(props.annotation.note_keys || {})) {
            if (value === EPropertyType.BOOLEAN) keyTypes.push(key);
        }
        setMetadataKeys(keyTypes);
    }, [current, props.annotation]);

    return (
        <>
            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>type</b> that you would like to use for your meta analysis
            </Box>

            <FormControl sx={MetaAnalysisDataStyles.spaceBelow}>
                <InputLabel id="select-label">analysis type</InputLabel>
                <Select
                    onBlur={handleOnBlur}
                    onFocus={handleOnFocus}
                    error={!isValid}
                    required
                    labelId="select-label"
                    onChange={(event) => {
                        const value = event.target.value as EAnalysisType;
                        props.onUpdate({ analysisType: value, algorithm: null });
                        handleChange(value);
                    }}
                    label="analysis type"
                    value={props.analysisType || ''}
                    sx={[MetaAnalysisDataStyles.selectInput]}
                >
                    <MenuItem value={EAnalysisType.CBMA}>Coordinate Based Meta Analysis</MenuItem>
                    <MenuItem value={EAnalysisType.IBMA}>Image Based Meta Analysis</MenuItem>
                </Select>
                {!isValid && (
                    <FormHelperText sx={{ color: 'error.main' }}>this is required</FormHelperText>
                )}
            </FormControl>

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>studyset</b> that you would like to use for your meta analysis
            </Box>

            <NeurosynthAutocomplete
                label="studyset"
                shouldDisable={props.analysisType === undefined}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={props.studyset || null}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    props.onUpdate({ studyset: newVal, annotation: null });
                }}
                options={props.studysets}
            />

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>annotation</b> that you would like to use for your meta analysis
            </Box>

            <NeurosynthAutocomplete
                label="annotation"
                shouldDisable={!props.studyset}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={props.annotation || null}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    props.onUpdate({ annotation: newVal });
                }}
                options={annotations || []}
            />

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>inclusion column</b> that you would like to use for your meta analysis
            </Box>

            <NeurosynthAutocomplete
                label="Inclusion Column"
                shouldDisable={!props.annotation}
                isOptionEqualToValue={(option, value) => option === value}
                value={props.inclusionColumn}
                sx={{ ...MetaAnalysisDataStyles.selectInput, ...{ marginBottom: '2rem' } }}
                getOptionLabel={(option) => option || ''}
                onChange={(_event, newVal, _reason) => {
                    props.onUpdate({ inclusionColumn: newVal });
                }}
                options={metadataKeys || []}
            />

            <NavigationButtons
                onButtonClick={props.onNext}
                prevButtonDisabled={true}
                nextButtonDisabled={!props.analysisType || !props.studyset || !props.annotation}
                nextButtonStyle="outlined"
            />
        </>
    );
};

export default MetaAnalysisData;
