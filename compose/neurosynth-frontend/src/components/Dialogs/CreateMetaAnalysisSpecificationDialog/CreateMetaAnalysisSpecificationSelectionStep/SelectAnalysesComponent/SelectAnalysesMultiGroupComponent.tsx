import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useMemo } from 'react';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import { DEFAULT_REFERENCE_DATASETS, IMultiGroupOption } from './SelectAnalysesComponent.types';
import useInclusionColumnOptions from './useInclusionColumnOptions';
const SelectAnalysesMultiGroupComponent: React.FC<{
    algorithm: IAlgorithmSelection;
    onSelectValue: (option: IAnalysesSelection) => void;
    annotationId: string | undefined;
    selectedValue: IAnalysesSelection;
}> = (props) => {
    const { algorithm, onSelectValue, annotationId, selectedValue } = props;

    const columnOptions = useInclusionColumnOptions(annotationId, selectedValue?.selectionKey);
    const colOptionsToMultiGroupOptions: IMultiGroupOption[] = useMemo(() => {
        return columnOptions
            .filter((option) => option !== selectedValue?.selectionValue?.toString())
            .map((option) => ({
                label: option,
                description: '',
                type: `Column Values (${selectedValue?.selectionKey})`,
                id: option,
            }));
    }, [columnOptions, selectedValue?.selectionKey, selectedValue?.selectionValue]);

    const multiGroupOptions: IMultiGroupOption[] = useMemo(() => {
        return [...DEFAULT_REFERENCE_DATASETS, ...colOptionsToMultiGroupOptions];
    }, [colOptionsToMultiGroupOptions]);

    const selectedOption = useMemo(() => {
        if (!selectedValue.referenceDataset) return undefined;

        const foundOption = multiGroupOptions.find(
            (x) => x.label === selectedValue.referenceDataset
        );
        return foundOption;
    }, [multiGroupOptions, selectedValue.referenceDataset]);

    const handleSelect = (option: IMultiGroupOption | undefined) => {
        if (!selectedValue) return;

        onSelectValue({
            ...selectedValue,
            referenceDataset: option?.label,
        });
    };

    return (
        <Box sx={{ margin: '1rem 0' }}>
            <Typography sx={{ marginBottom: '1rem' }}>
                You selected <b>{algorithm?.estimator?.label || ''}</b> in the previous step, which
                is an estimator that requires a second dataset to use as a comparison. Select a
                dataset using the dropdown below. You can either select our default reference
                datasets (i.e. neurostore, neuroquery, etc) or choose another value from the
                inclusion column you set above to use as your own dataset.
            </Typography>
            <Box
                sx={{
                    padding: '2rem 0 2rem 3rem',
                    borderLeft: '6px solid',
                    borderColor: 'secondary.main',
                }}
            >
                <NeurosynthAutocomplete
                    label="Select value to filter on"
                    groupBy={(option) => option?.type || ''}
                    shouldDisable={false}
                    isOptionEqualToValue={(option, value) => option?.label === value?.label}
                    value={selectedOption}
                    size="medium"
                    inputPropsSx={{
                        color: NeurosynthTableStyles[EPropertyType.NONE],
                    }}
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option?.label}>
                            <ListItemText primary={option?.label || ''} />
                        </ListItem>
                    )}
                    getOptionLabel={(option) => `${option?.label}`}
                    onChange={(_event, newVal, _reason) => handleSelect(newVal || undefined)}
                    options={multiGroupOptions}
                />
            </Box>
        </Box>
    );
};

export default SelectAnalysesMultiGroupComponent;
