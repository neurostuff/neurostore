import { ListItem, ListItemText } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useMemo } from 'react';
import { IAnalysesSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';

const SelectAnalysesStringValue: React.FC<{
    selectedValue: IAnalysesSelection | undefined;
    onSelectValue: (newVal: IAnalysesSelection) => void;
    allNotes: NoteCollectionReturn[] | undefined;
}> = (props) => {
    const { selectedValue, onSelectValue, allNotes } = props;

    const options = useMemo(() => {
        if (!selectedValue || !selectedValue.selectionKey) return [];
        const { selectionKey } = selectedValue;

        const annotationValuesSet = new Set<string>();
        (allNotes || []).forEach((note) => {
            if (!note.note) return;
            const value = (note.note as { [key: string]: string })[selectionKey];
            if (annotationValuesSet.has(value)) {
            } else {
                annotationValuesSet.add(value);
            }
        });

        return Array.from(annotationValuesSet);
    }, [allNotes, selectedValue]);

    const handleSelect = (val: AnnotationNoteValue | undefined | null) => {
        if (!selectedValue) return;
        onSelectValue({
            ...selectedValue,
            selectionValue: val === null ? undefined : val,
        });
    };

    return (
        <NeurosynthAutocomplete
            label="Select value to filter on"
            shouldDisable={false}
            isOptionEqualToValue={(option, value) => option === value}
            value={selectedValue?.selectionValue}
            size="medium"
            inputPropsSx={{
                color: NeurosynthTableStyles[selectedValue?.type || EPropertyType.NONE],
            }}
            required={false}
            renderOption={(params, option) => (
                <ListItem {...params} key={option}>
                    <ListItemText
                        sx={{
                            color: NeurosynthTableStyles[EPropertyType.STRING],
                        }}
                        primary={option || ''}
                    />
                </ListItem>
            )}
            getOptionLabel={(option) => `${option}`}
            onChange={(_event, newVal, _reason) => handleSelect(newVal)}
            options={options}
        />
    );
};

export default SelectAnalysesStringValue;
