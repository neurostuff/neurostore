import { createFilterOptions, ListItem, ListItemText } from '@mui/material';
import { useContext, useState } from 'react';
import { GlobalContext, SnackbarType } from 'contexts/GlobalContext';
import { useCreateCondition, useGetConditions } from 'hooks';
import { CreateDetailsDialog, NeurosynthAutocomplete } from 'components';
import { ConditionReturn } from 'neurostore-typescript-sdk';

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
    const {
        isLoading: getConditionsIsLoading,
        data: conditions,
        isError: getConditionsIsError,
    } = useGetConditions();
    const { mutate, isLoading: createConditionIsLoading } = useCreateCondition();

    const { showSnackbar } = useContext(GlobalContext);

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
                    showSnackbar('created condition ' + name, SnackbarType.SUCCESS);
                },
                onError: (data, _variables, _context) => {
                    showSnackbar('there was an error', SnackbarType.ERROR);
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
            <NeurosynthAutocomplete
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
                    <ListItem {...params}>
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
            />

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
