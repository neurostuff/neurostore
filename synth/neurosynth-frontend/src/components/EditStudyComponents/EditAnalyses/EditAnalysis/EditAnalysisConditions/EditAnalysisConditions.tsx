import {
    Autocomplete,
    TextField,
    createFilterOptions,
    Box,
    Typography,
    Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useEffect, useState } from 'react';
import useIsMounted from '../../../../../hooks/useIsMounted';
import API, { ConditionApiResponse } from '../../../../../utils/api';

const filterOptions = createFilterOptions<{
    id: string;
    label: string;
    description: string;
    isAddOption?: boolean;
}>();

const EditAnalysisConditions: React.FC<{
    conditions: ConditionApiResponse[] | undefined;
    weights: number[] | undefined;
}> = (props) => {
    const [conditions, setConditions] = useState<
        { id: string; label: string; description: string }[] | undefined
    >();
    const isMountedRef = useIsMounted();
    const [selectedValue, setSelectedValue] = useState<
        { id: string; label: string; description: string } | undefined | null
    >(null);

    useEffect(() => {
        const getConditions = () => {
            API.Services.ConditionsService.conditionsGet()
                .then((res) => {
                    if (isMountedRef.current) {
                        const conditionOptions = (res.data.results || []).map((condition) => ({
                            id: condition.id || '',
                            label: condition.name || '',
                            description: condition.description || '',
                        }));

                        setConditions(conditionOptions);
                    }
                })
                .catch((err) => {});
        };

        getConditions();
    }, [isMountedRef]);

    const conditionWeightsList = (props.conditions || []).map((condition, index) => ({
        id: condition.id,
        weight: (props.weights || [])[index] || 1,
        condition: condition.name,
    }));

    return (
        <>
            <Autocomplete
                sx={{ margin: '1rem 0rem' }}
                options={conditions || []}
                value={selectedValue}
                onChange={(event, newValue) => {
                    setSelectedValue(newValue);
                    console.log(event);

                    console.log(newValue);
                }}
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

            <Box>
                <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                    Conditions for this analysis
                </Typography>

                <DataGrid
                    sx={{
                        '& .readonly': {
                            color: 'darkgray',
                        },
                    }}
                    autoHeight
                    hideFooter={true}
                    rows={conditionWeightsList}
                    columns={[
                        { field: 'weight', headerName: 'Weights', flex: 1, editable: true },
                        {
                            field: 'condition',
                            headerName: 'Conditions',
                            flex: 2,
                            cellClassName: 'readonly',
                        },
                        {
                            field: 'action',
                            headerName: 'Actions',
                            width: 100,
                            editable: false,
                            renderCell: (params) => {
                                return (
                                    <>
                                        <Button color="error">Delete</Button>
                                    </>
                                );
                            },
                        },
                    ]}
                />
            </Box>
        </>
    );
};

export default EditAnalysisConditions;
