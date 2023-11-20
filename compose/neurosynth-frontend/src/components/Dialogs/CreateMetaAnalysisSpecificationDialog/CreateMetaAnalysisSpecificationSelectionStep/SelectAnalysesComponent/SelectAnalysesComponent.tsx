import { Box, ListItem, ListItemText } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useEffect, useMemo, useRef } from 'react';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import SelectAnalysesComponentTable from './SelectAnalysesComponentTable';
import SelectAnalysesStringValue from './SelectAnalysesStringValue';
import {
    isMultiGroupAlgorithm,
    selectedReferenceDatasetIsDefault,
} from './SelectAnalysesComponent.helpers';
import SelectAnalysesMultiGroupComponent from './SelectAnalysesMultiGroupComponent';
import { DEFAULT_REFERENCE_DATASETS } from './SelectAnalysesComponent.types';
import CreateMetaAnalysisSpecificationDialogBaseStyles from '../../CreateMetaAnalysisSpecificationDialogBase.styles';

const SelectAnalysesComponent: React.FC<{
    annotationId: string;
    selectedValue: IAnalysesSelection;
    onSelectValue: (value: IAnalysesSelection) => void;
    algorithm: IAlgorithmSelection;
}> = (props) => {
    const { annotationId, selectedValue, onSelectValue, algorithm } = props;
    const { data: annotation } = useGetAnnotationById(annotationId);

    // we need some notion of "touched" in order to know if the input is being seen for the first time (so we can set some default value)
    // versus the input being cleared (in which case we dont do anything)
    const selectionOccurred = useRef<boolean>(false);

    useEffect(() => {
        if (selectedValue.selectionKey) {
            selectionOccurred.current = true;
            return;
        } else if (!selectionOccurred.current && 'included' in (annotation?.note_keys || {})) {
            const initialVal: IAnalysesSelection = {
                selectionKey: 'included',
                type: EPropertyType.BOOLEAN,
                selectionValue: true,
            };

            if (isMultiGroupAlgorithm(algorithm?.estimator)) {
                initialVal.referenceDataset = DEFAULT_REFERENCE_DATASETS[0].label;
            }

            onSelectValue(initialVal);
            selectionOccurred.current = true;
        }
    }, [
        selectedValue.selectionKey,
        annotation,
        onSelectValue,
        selectionOccurred,
        algorithm?.estimator,
    ]);

    const options = useMemo(() => {
        return Object.entries(annotation?.note_keys || {})
            .map(([key, value]) => ({
                selectionKey: key,
                type: value as EPropertyType,
                selectionValue: undefined,
                referenceDataset: undefined,
            }))
            .filter((x) => x.type === EPropertyType.BOOLEAN || x.type === EPropertyType.STRING);
    }, [annotation?.note_keys]);

    const stringInclusionColSelected = selectedValue?.type === EPropertyType.STRING;
    const showInclusionSummary = stringInclusionColSelected
        ? !!selectedValue?.selectionValue
        : !!selectedValue?.selectionKey;
    const showMultiGroup = isMultiGroupAlgorithm(algorithm?.estimator);

    const handleSelectColumn = (newVal: IAnalysesSelection | undefined) => {
        if (newVal?.selectionKey === selectedValue.selectionKey) return; // we selected the same option that is already selected

        const referenceDatasetIsNowInvalid = !selectedReferenceDatasetIsDefault(
            selectedValue.referenceDataset
        );
        if (!newVal) {
            onSelectValue({
                selectionKey: undefined,
                type: undefined,
                selectionValue: undefined,
                referenceDataset: referenceDatasetIsNowInvalid
                    ? undefined
                    : selectedValue.referenceDataset,
            });
            return;
        }

        const update: IAnalysesSelection = {
            selectionKey: newVal.selectionKey,
            type: newVal.type,
            selectionValue: newVal.type === EPropertyType.BOOLEAN ? true : undefined,
            referenceDataset: referenceDatasetIsNowInvalid
                ? undefined
                : selectedValue.referenceDataset,
        };
        onSelectValue(update);
    };

    return (
        <Box>
            <NeurosynthAutocomplete
                sx={CreateMetaAnalysisSpecificationDialogBaseStyles.highlightInput}
                label="Inclusion Column"
                shouldDisable={false}
                isOptionEqualToValue={(option, value) =>
                    option?.selectionKey === value?.selectionKey
                }
                value={selectedValue?.selectionKey ? selectedValue : undefined}
                size="medium"
                inputPropsSx={{
                    color: NeurosynthTableStyles[selectedValue?.type || EPropertyType.NONE],
                }}
                required={false}
                renderOption={(params, option) => (
                    <ListItem {...params} key={option.selectionKey}>
                        <ListItemText
                            sx={{
                                color: NeurosynthTableStyles[option.type || EPropertyType.NONE],
                            }}
                            primary={option?.selectionKey || ''}
                        />
                    </ListItem>
                )}
                getOptionLabel={(option) => option?.selectionKey || ''}
                onChange={(_event, newVal, _reason) => handleSelectColumn(newVal || undefined)}
                options={options}
            />
            {stringInclusionColSelected && (
                <Box
                    sx={{
                        padding: '1rem 0 2rem 3rem',
                        borderLeft: '6px solid',
                        borderColor: 'secondary.main',
                    }}
                >
                    <SelectAnalysesStringValue
                        annotationId={annotationId}
                        selectedValue={selectedValue}
                        onSelectValue={(newVal) => onSelectValue(newVal)}
                    />
                </Box>
            )}
            {showInclusionSummary && (
                <Box
                    sx={{
                        marginTop: '1rem',
                    }}
                >
                    <SelectAnalysesComponentTable
                        selectedValue={selectedValue}
                        allNotes={annotation?.notes as NoteCollectionReturn[] | undefined}
                    />
                </Box>
            )}
            {showMultiGroup && (
                <SelectAnalysesMultiGroupComponent
                    onSelectValue={(newVal) => onSelectValue(newVal)}
                    annotationId={annotationId}
                    selectedValue={selectedValue}
                    algorithm={algorithm}
                />
            )}
        </Box>
    );
};

export default SelectAnalysesComponent;
