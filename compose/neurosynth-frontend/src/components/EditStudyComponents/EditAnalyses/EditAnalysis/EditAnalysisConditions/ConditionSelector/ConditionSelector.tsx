import { createFilterOptions, ListItem, ListItemText } from '@mui/material';
import React, { useState } from 'react';
import { useCreateCondition, useGetConditions } from 'hooks';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { ConditionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';

interface AutoSelectOption {
    id: string;
    label: string;
    description: string;
    addOptionActualLabel?: string | null;
}

const filterOptions = createFilterOptions<AutoSelectOption | undefined>({
    ignoreAccents: true,
    ignoreCase: true,
    matchFrom: 'any',
    trim: true,
});

const ConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionReturn) => void;
}> = (props) => {
    const { enqueueSnackbar } = useSnackbar();
    const {
        isLoading: getConditionsIsLoading,
        data: conditions,
        isError: getConditionsIsError,
    } = useGetConditions();
    const { mutate, isLoading: createConditionIsLoading } = useCreateCondition();

    const [selectedValue, setSelectedValue] = useState<AutoSelectOption>();
    const [dialog, setDialog] = useState({
        isOpen: false,
        initName: '',
    });

    const handleOnCreate = async (name: string, description: string) => {
        mutate(
            {
                name,
                description,
            },
            {
                onSuccess: (_data, _variables, _context) => {
                    enqueueSnackbar('condition created', { variant: 'success' });
                },
                onError: (data, _variables, _context) => {
                    enqueueSnackbar('there was an error', { variant: 'error' });
                },
            }
        );
    };

    const conditionOptions: AutoSelectOption[] = (conditions || []).map((condition) => ({
        id: condition.id || '',
        label: condition.name || '',
        description: condition.description || '',
        addOptionActualLabel: null,
    }));

    return (
        <>
            {/* <NeurosynthAutocomplete
                isLoading={getConditionsIsLoading || createConditionIsLoading}
                isError={getConditionsIsError}
                value={selectedValue}
                required={false}
                label="add a new condition"
                options={conditionOptions}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                getOptionLabel={(option) => option?.label || ''}
                onChange={(_event, newValue, _reason) => {
                    if (newValue) {
                        if (newValue.addOptionActualLabel) {
                            setDialog({ isOpen: true, initName: newValue.addOptionActualLabel });
                            return;
                        }

                        const selectedCondition = (conditions || [])?.find(
                            (condition) => condition.id === newValue?.id
                        );
                        if (selectedCondition) {
                            setSelectedValue(newValue);
                            props.onConditionSelected(selectedCondition);
                        }
                    }
                }}
                renderOption={(params, option) => (
                    <ListItem {...params} key={option?.id}>
                        <ListItemText
                            primary={option?.label || ''}
                            secondary={option?.description || ''}
                        />
                    </ListItem>
                )}
                filterOptions={(options, params) => {
                    const filteredValues = filterOptions(options, params);

                    const optionExists = options.some(
                        (option) =>
                            params.inputValue.toLocaleLowerCase() ===
                            (option?.label || '').toLocaleLowerCase()
                    );

                    if (params.inputValue !== '' && !optionExists) {
                        filteredValues.push({
                            id: '',
                            label: `Add "${params.inputValue}"`,
                            description: '',
                            addOptionActualLabel: params.inputValue,
                        });
                    }
                    return filteredValues;
                }}
            /> */}

            <CreateDetailsDialog
                isOpen={dialog.isOpen}
                onCreate={handleOnCreate}
                titleText="Create a new condition"
                onCloseDialog={() => setDialog({ isOpen: false, initName: '' })}
                initName={dialog.initName}
            />
        </>
    );
};

export default ConditionSelector;
