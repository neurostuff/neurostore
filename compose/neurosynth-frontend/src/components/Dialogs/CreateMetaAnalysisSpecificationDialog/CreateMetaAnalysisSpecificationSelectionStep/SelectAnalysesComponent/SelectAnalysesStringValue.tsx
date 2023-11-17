import { ListItem, ListItemText } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { IAnalysesSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import useInclusionColumnOptions from './useInclusionColumnOptions';

const SelectAnalysesStringValue: React.FC<{
    selectedValue: IAnalysesSelection | undefined;
    onSelectValue: (newVal: IAnalysesSelection) => void;
    annotationId: string | undefined;
}> = (props) => {
    const { selectedValue, onSelectValue, annotationId } = props;
    const options = useInclusionColumnOptions(annotationId, selectedValue?.selectionKey);

    const handleSelect = (val: AnnotationNoteValue | undefined | null) => {
        if (!selectedValue) return;

        const update: IAnalysesSelection = {
            ...selectedValue,
            selectionValue: val === null ? undefined : val,
        };

        if (selectedValue?.referenceDataset && val === selectedValue.referenceDataset) {
            // clear the reference dataset field if its the same as the value being selected
            update.referenceDataset = undefined;
        }

        onSelectValue(update);
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
