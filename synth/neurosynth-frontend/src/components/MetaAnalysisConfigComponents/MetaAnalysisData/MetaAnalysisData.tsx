import {
    Autocomplete,
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    ListItemText,
    ListItem,
} from '@mui/material';
import { SyntheticEvent, useEffect, useState } from 'react';
import { NavigationButtons } from '../..';
import useIsMounted from '../../../hooks/useIsMounted';
import { EAlgorithmType } from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import API, { AnnotationsApiResponse, StudysetsApiResponse } from '../../../utils/api';
import { ENavigationButton } from '../../NavigationButtons/NavigationButtons';
import MetaAnalysisDataStyles from './MetaAnalysisData.styles';

export interface IMetaAnalysisData {
    studysets: StudysetsApiResponse[];
    onNext: (button: ENavigationButton) => void;
}

const MetaAnalysisData: React.FC<IMetaAnalysisData> = (props) => {
    const [selectedAlgorithmType, setSelectedAlgorithmType] = useState<EAlgorithmType>();
    const [selectedStudyset, setSelectedStudyset] = useState<StudysetsApiResponse>();
    const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationsApiResponse>();

    const [annotations, setAnnotations] = useState<AnnotationsApiResponse[]>();

    const { current } = useIsMounted();

    const handleOnChange = (
        _event: SyntheticEvent,
        newValue: StudysetsApiResponse | null,
        _reason?: 'createOption' | 'selectOption' | 'removeOption' | 'blur' | 'clear'
    ) => {
        if (newValue && newValue.id) {
            setSelectedStudyset(newValue);
        }
    };

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
            <FormControl>
                <InputLabel id="select-label">analysis type</InputLabel>
                <Select
                    required
                    labelId="select-label"
                    onChange={(event) =>
                        setSelectedAlgorithmType(event.target.value as EAlgorithmType)
                    }
                    label="analysis type"
                    value={selectedAlgorithmType || ''}
                    sx={[MetaAnalysisDataStyles.selectInput, MetaAnalysisDataStyles.spaceBelow]}
                >
                    <MenuItem value={EAlgorithmType.CBMA}>Coordinate Based Meta Analysis</MenuItem>
                    <MenuItem value={EAlgorithmType.IBMA}>Image Based Meta Analysis</MenuItem>
                </Select>
            </FormControl>

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>studyset</b> that you would like to use for your meta analysis
            </Box>

            <Autocomplete
                disabled={selectedAlgorithmType === undefined}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={[MetaAnalysisDataStyles.spaceBelow, MetaAnalysisDataStyles.selectInput]}
                renderInput={(params) => <TextField {...params} label="studyset" />}
                value={selectedStudyset || null}
                getOptionLabel={(option) => option?.name || ''}
                onChange={handleOnChange}
                options={props.studysets}
            />

            <Box sx={MetaAnalysisDataStyles.spaceBelow}>
                Select the <b>annotation</b> that you would like to use for your meta analysis
            </Box>

            <Autocomplete
                disabled={selectedStudyset === undefined}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.name} secondary={option.description} />
                    </ListItem>
                )}
                sx={[MetaAnalysisDataStyles.spaceBelow, MetaAnalysisDataStyles.selectInput]}
                renderInput={(params) => <TextField {...params} label="annotation" />}
                value={selectedAnnotation || null}
                getOptionLabel={(option) => option.name || ''}
                onChange={(_event, newVal, _reason) => {
                    if (newVal) setSelectedAnnotation(newVal);
                }}
                options={annotations || []}
            />

            <NavigationButtons
                onButtonClick={handleNavigationButtonClick}
                prevButtonDisabled={true}
                nextButtonDisabled={
                    selectedAlgorithmType === undefined ||
                    selectedStudyset === undefined ||
                    selectedAnnotation === undefined
                }
                nextButtonStyle="contained"
            />
        </>
    );
};

export default MetaAnalysisData;
