import { useAuth0 } from '@auth0/auth0-react';
import { createFilterOptions, Autocomplete, TextField } from '@mui/material';
import { SyntheticEvent, useContext, useEffect, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../../../../../contexts/GlobalContext';
import useIsMounted from '../../../../../../hooks/useIsMounted';
import API, { ConditionApiResponse } from '../../../../../../utils/api';
import CreateDetailsDialog from '../../../../../Dialogs/CreateDetailsDialog/CreateDetailsDialog';

const filterOptions = createFilterOptions<{
    id: string;
    label: string;
    description: string;
    isAddOption?: boolean;
}>();

const ConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionApiResponse) => void;
}> = (props) => {
    const context = useContext(GlobalContext);
    const isMountedRef = useIsMounted();
    const { getAccessTokenSilently } = useAuth0();

    const [selectedValue, setSelectedValue] = useState<{
        id: string;
        label: string;
        description: string;
        isAddOption?: boolean;
    } | null>(null);
    const [allConditions, setAllConditions] = useState<ConditionApiResponse[]>([]);
    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    useEffect(() => {
        const getConditions = () => {
            API.Services.ConditionsService.conditionsGet()
                .then((res) => {
                    if (isMountedRef.current && res?.data?.results) {
                        setAllConditions(res.data.results);
                    }
                })
                .catch((err) => {
                    context.showSnackbar(
                        'there was an error fetching conditions',
                        SnackbarType.ERROR
                    );
                    console.error(err);
                });
        };

        getConditions();
    }, [context, isMountedRef]);

    const handleOnCreate = async (name: string, description: string) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
            context.showSnackbar('successfully created new condition', SnackbarType.SUCCESS);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.ConditionsService.conditionsPost({
            name,
            description,
        });
    };

    const handleOnChange = (
        _event: SyntheticEvent,
        newValue: { id: string; label: string; description: string; isAddOption?: boolean } | null,
        _reason?: 'createOption' | 'selectOption' | 'removeOption' | 'blur' | 'clear'
    ) => {
        if (newValue?.isAddOption) {
            setDialogIsOpen(true);
        }

        const selectedCondition = (allConditions || [])?.find(
            (condition) => condition.id === newValue?.id
        );
        if (selectedCondition) {
            setSelectedValue(newValue);
            props.onConditionSelected(selectedCondition);
        }
    };

    const conditionOptions: {
        id: string;
        label: string;
        description: string;
        isAddOption?: boolean;
    }[] = allConditions.map((condition) => ({
        id: condition.id || '',
        label: condition.name || '',
        description: condition.description || '',
        isAddOption: false,
    }));

    return (
        <>
            <Autocomplete
                sx={{ margin: '1rem 0rem' }}
                options={conditionOptions || []}
                value={selectedValue}
                onChange={handleOnChange}
                getOptionLabel={(option) => option.label}
                renderInput={(params) => (
                    <TextField {...params} placeholder="condition" label="add a new condition" />
                )}
                filterOptions={(options, params) => {
                    const filteredValues = filterOptions(options, params);

                    const optionExists = options.some(
                        (option) =>
                            params.inputValue.toLocaleLowerCase() ===
                            option.label.toLocaleLowerCase()
                    );

                    if (params.inputValue !== '' && !optionExists) {
                        filteredValues.push({
                            id: '',
                            label: `Add "${params.inputValue}"`,
                            description: '',
                            isAddOption: true,
                        });
                    }
                    return filteredValues;
                }}
            />
            <CreateDetailsDialog
                isOpen={dialogIsOpen}
                onCreate={handleOnCreate}
                titleText="Create a new condition"
                onCloseDialog={() => setDialogIsOpen(false)}
            />
        </>
    );
};

export default ConditionSelector;
