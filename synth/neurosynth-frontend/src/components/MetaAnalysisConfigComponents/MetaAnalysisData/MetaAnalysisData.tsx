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
import { NavigationButtons } from '../..';
import { useInputValidation } from '../../../hooks';
import useIsMounted from '../../../hooks/useIsMounted';
import { EAlgorithmType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import API, { AnnotationsApiResponse, StudysetsApiResponse } from '../../../utils/api';
import { ENavigationButton } from '../../NavigationButtons/NavigationButtons';
import NeurosynthAutocomplete from '../../NeurosynthAutocomplete/NeurosynthAutocomplete';
import MetaAnalysisDataStyles from './MetaAnalysisData.styles';

export interface IMetaAnalysisData {
    studysets: StudysetsApiResponse[];
    onNext: (button: ENavigationButton) => void;
}
const validationFunc = (arg: EAlgorithmType | undefined | null) => !!arg;

const MetaAnalysisData: React.FC<IMetaAnalysisData> = (props) => {
    const [selectedAlgorithmType, setSelectedAlgorithmType] = useState<EAlgorithmType>();
    const [selectedStudyset, setSelectedStudyset] = useState<StudysetsApiResponse | null>();
    const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationsApiResponse | null>();
    const [annotations, setAnnotations] = useState<AnnotationsApiResponse[]>();

    const { current } = useIsMounted();

    const { handleChange, handleOnBlur, handleOnFocus, isValid } =
        useInputValidation(validationFunc);

    const handleNavigationButtonClick = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) return;
        props.onNext(ENavigationButton.NEXT);
    };

    useEffect(() => {
        if (!selectedStudyset || !selectedStudyset.id) return;

        const getAnnotationsForStudyset = (id: string) => {
            API.Services.AnnotationsService.annotationsGet(id).then((res) => {
                if (current && res && res.data && res.data.results) {
                    const typedRes = res.data.results as AnnotationsApiResponse[];

                    setAnnotations(typedRes);
                }
            });
        };

        getAnnotationsForStudyset(selectedStudyset.id);
    }, [current, selectedStudyset]);

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
                        const value = event.target.value as EAlgorithmType;
                        setSelectedAlgorithmType(value);
                        handleChange(value);
                    }}
                    label="analysis type"
                    value={selectedAlgorithmType || ''}
                    sx={[MetaAnalysisDataStyles.selectInput]}
                >
                    <MenuItem value={EAlgorithmType.CBMA}>Coordinate Based Meta Analysis</MenuItem>
                    <MenuItem value={EAlgorithmType.IBMA}>Image Based Meta Analysis</MenuItem>
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
                shouldDisable={selectedAlgorithmType === undefined}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={selectedStudyset || null}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    setSelectedStudyset(newVal);
                    setSelectedAnnotation(null);
                }}
                options={props.studysets}
            />

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>annotation</b> that you would like to use for your meta analysis
            </Box>

            <NeurosynthAutocomplete
                label="annotation"
                shouldDisable={selectedStudyset === undefined || selectedStudyset === null}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={selectedAnnotation || null}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={{ ...MetaAnalysisDataStyles.spaceBelow, ...MetaAnalysisDataStyles.selectInput }}
                getOptionLabel={(option) => option?.name || ''}
                onChange={(_event, newVal, _reason) => {
                    setSelectedAnnotation(newVal);
                }}
                options={annotations || []}
            />

            <NavigationButtons
                onButtonClick={handleNavigationButtonClick}
                prevButtonDisabled={true}
                nextButtonDisabled={
                    !selectedAlgorithmType || !selectedStudyset || !selectedAnnotation
                }
                nextButtonStyle="contained"
            />
        </>
    );
};

export default MetaAnalysisData;
