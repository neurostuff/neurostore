import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    ListItemText,
    ListItem,
    FormHelperText,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { IMetaAnalysisData } from '..';
import NavigationButtons from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useInputValidation, useGetStudysets, useGetAnnotationsByStudysetId } from '../../../hooks';
import { EAnalysisType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { EPropertyType } from '../../EditMetadata';
import NeurosynthAutocomplete from '../../NeurosynthAutocomplete/NeurosynthAutocomplete';
import MetaAnalysisDataStyles from './MetaAnalysisData.styles';

const MetaAnalysisData: React.FC<IMetaAnalysisData> = (props) => {
    const {
        data: studysetsData,
        isLoading: studysetsIsLoading,
        isError: studysetsIsError,
    } = useGetStudysets();
    const {
        data: annotationsData,
        isLoading: annotationsIsLoading,
        isError: annotationsIsError,
    } = useGetAnnotationsByStudysetId(props.studyset?.id);

    const [metadataKeys, setMetadataKeys] = useState<string[]>();

    const { handleChange, handleOnBlur, handleOnFocus, isValid } = useInputValidation(
        props.metaAnalysisType,
        (arg: EAnalysisType | undefined | null) => !!arg
    );

    useEffect(() => {
        if (!props.annotation || !props.annotation.id) return;

        const keyTypes: string[] = [];
        for (const [key, value] of Object.entries(props.annotation.note_keys || {})) {
            if (value === EPropertyType.BOOLEAN) keyTypes.push(key);
        }
        setMetadataKeys(keyTypes);
    }, [props.annotation]);

    return (
        <>
            <Typography sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>type</b> that you would like to use for your meta-analysis
            </Typography>

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
                        props.onUpdate({ analysisType: value, estimator: null });
                        handleChange(value);
                    }}
                    label="analysis type"
                    value={props.metaAnalysisType || ''}
                    sx={[MetaAnalysisDataStyles.selectInput]}
                >
                    <MenuItem value={EAnalysisType.CBMA}>Coordinate Based Meta-Analysis</MenuItem>
                    <MenuItem value={EAnalysisType.IBMA}>Image Based Meta-Analysis</MenuItem>
                </Select>
                {!isValid && (
                    <FormHelperText sx={{ color: 'error.main' }}>this is required</FormHelperText>
                )}
            </FormControl>

            <Typography sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>studyset</b> that you would like to use for your meta-analysis
            </Typography>

            <NeurosynthAutocomplete
                label="studyset"
                isLoading={studysetsIsLoading}
                isError={studysetsIsError}
                shouldDisable={props.metaAnalysisType === undefined}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={props.studyset || null}
                renderOption={(params, option) => (
                    <ListItem {...params} key={option?.id}>
                        <ListItemText
                            primary={option?.name || ''}
                            secondary={option?.description || ''}
                        />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    props.onUpdate({ studyset: newVal, annotation: null, inclusionColumn: null });
                }}
                options={studysetsData || []}
            />

            <Typography sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>annotation</b> that you would like to use for your meta-analysis
            </Typography>

            <NeurosynthAutocomplete
                isLoading={annotationsIsLoading}
                isError={annotationsIsError}
                label="annotation"
                shouldDisable={!props.studyset}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={props.annotation || null}
                renderOption={(params, option) => (
                    <ListItem {...params} key={option?.id}>
                        <ListItemText
                            primary={option?.name || ''}
                            secondary={option?.description || ''}
                        />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    props.onUpdate({ annotation: newVal, inclusionColumn: null });
                }}
                options={annotationsData || []}
            />

            <Typography sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>inclusion column</b> that you would like to use for your meta-analysis
            </Typography>

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
                nextButtonDisabled={!props.metaAnalysisType || !props.studyset || !props.annotation}
                nextButtonStyle="outlined"
            />
        </>
    );
};

export default MetaAnalysisData;
