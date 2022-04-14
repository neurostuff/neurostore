import { useAuth0 } from '@auth0/auth0-react';
import {
    createFilterOptions,
    Autocomplete,
    TextField,
    ListItem,
    ListItemText,
} from '@mui/material';
import { SyntheticEvent, useContext, useEffect, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../../../../../contexts/GlobalContext';
import useIsMounted from '../../../../../../hooks/useIsMounted';
import API, { ConditionApiResponse } from '../../../../../../utils/api';
import { CreateDetailsDialog } from '../../../../../';

interface AutoSelectOption {
    id: string;
    label: string;
    description: string;
    addOptionActualLabel?: string | null;
}

const filterOptions = createFilterOptions<AutoSelectOption>({
    ignoreAccents: true,
    ignoreCase: true,
    matchFrom: 'any',
    trim: true,
});

const ConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionApiResponse) => void;
}> = (props) => {
    const context = useContext(GlobalContext);
    const isMountedRef = useIsMounted();
    const { getAccessTokenSilently } = useAuth0();

    const [selectedValue, setSelectedValue] = useState<AutoSelectOption | null>(null);
    const [allConditions, setAllConditions] = useState<ConditionApiResponse[]>([]);
    const [dialog, setDialog] = useState({
        isOpen: false,
        initName: '',
    });

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
        })
            .then((res) => {
                if (isMountedRef.current && res.data) {
                    setAllConditions((prevState) => {
                        const newState = [...prevState];
                        newState.unshift(res.data);
                        return newState;
                    });
                }
            })
            .catch((exception) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            });
    };

    const handleOnChange = (
        _event: SyntheticEvent,
        newValue: AutoSelectOption | null,
        _reason?: 'createOption' | 'selectOption' | 'removeOption' | 'blur' | 'clear'
    ) => {
        if (newValue) {
            if (newValue.addOptionActualLabel) {
                setDialog({ isOpen: true, initName: newValue.addOptionActualLabel });
                return;
            }

            const selectedCondition = (allConditions || [])?.find(
                (condition) => condition.id === newValue?.id
            );
            if (selectedCondition) {
                setSelectedValue(newValue);
                props.onConditionSelected(selectedCondition);
            }
        }
    };

    const conditionOptions: AutoSelectOption[] = allConditions.map((condition) => ({
        id: condition.id || '',
        label: condition.name || '',
        description: condition.description || '',
        isAddOption: null,
    }));

    return (
        <>
            <Autocomplete
                sx={{ margin: '1rem 0rem' }}
                options={conditionOptions || []}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedValue}
                onChange={handleOnChange}
                getOptionLabel={(option) => option.label}
                renderOption={(params, option) => (
                    <ListItem {...params}>
                        <ListItemText primary={option.label} secondary={option.description} />
                    </ListItem>
                )}
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
