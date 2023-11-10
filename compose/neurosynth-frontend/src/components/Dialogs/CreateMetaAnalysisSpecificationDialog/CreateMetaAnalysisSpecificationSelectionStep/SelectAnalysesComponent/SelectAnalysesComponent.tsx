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
import { isMultiGroupAlgorithm } from './SelectAnalysesComponent.helpers';
import SelectAnalysesMultiGroupComponent from './SelectAnalysesMultiGroupComponent';

const SelectAnalysesComponent: React.FC<{
    annotationdId: string;
    selectedValue: IAnalysesSelection | undefined;
    onSelectValue: (value: IAnalysesSelection | undefined) => void;
    algorithm: IAlgorithmSelection;
}> = (props) => {
    const { annotationdId, selectedValue, onSelectValue, algorithm } = props;
    const { data: annotation } = useGetAnnotationById(annotationdId);

    // we need some notion of "touched" in order to know if the input is being seen for the first time (so we can set some default value)
    // versus the input being cleared (in which case we dont do anything)
    const selectionOccurred = useRef<boolean>(false);

    useEffect(() => {
        if (selectedValue?.selectionKey) {
            selectionOccurred.current = true;
            return;
        }

        if (!selectionOccurred.current && 'included' in (annotation?.note_keys || {})) {
            onSelectValue({
                selectionKey: 'included',
                type: EPropertyType.BOOLEAN,
                selectionValue: true,
            });
            selectionOccurred.current = true;
        }
    }, [selectedValue?.selectionKey, annotation, onSelectValue, selectionOccurred]);

    const options = useMemo(() => {
        return Object.entries(annotation?.note_keys || {})
            .map(([key, value]) => ({
                selectionKey: key,
                type: value as EPropertyType,
            }))
            .filter((x) => x.type === EPropertyType.BOOLEAN || x.type === EPropertyType.STRING);
    }, [annotation?.note_keys]);

    const stringInclusionColSelected = selectedValue?.type === EPropertyType.STRING;
    const showTable = stringInclusionColSelected
        ? !!selectedValue?.selectionValue
        : !!selectedValue?.selectionKey;
    const isMultiGroup = isMultiGroupAlgorithm(algorithm?.estimator);

    const handleSelectColumn = (selectedVal: IAnalysesSelection | null | undefined) => {
        const update = selectedVal;
        if (update) {
            if (update.type === EPropertyType.BOOLEAN) {
                update.selectionValue = true;
            } else {
                update.selectionValue = undefined;
            }
        }
        onSelectValue(update || undefined);
    };

    return (
        <Box>
            <NeurosynthAutocomplete
                sx={{
                    padding: '2rem 0 2rem 3rem',
                    borderLeft: '6px solid',
                    borderColor: 'secondary.main',
                }}
                label="Inclusion Column"
                shouldDisable={false}
                isOptionEqualToValue={(option, value) =>
                    option?.selectionKey === value?.selectionKey
                }
                value={selectedValue}
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
                onChange={(_event, newVal, _reason) => handleSelectColumn(newVal)}
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
                        selectedValue={selectedValue}
                        onSelectValue={(newVal) => onSelectValue(newVal)}
                        allNotes={annotation?.notes as NoteCollectionReturn[] | undefined}
                    />
                </Box>
            )}
            {showTable && (
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
            {isMultiGroup && <SelectAnalysesMultiGroupComponent algorithm={algorithm} />}
        </Box>
    );
};

export default SelectAnalysesComponent;
