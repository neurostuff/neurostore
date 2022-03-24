import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button } from '@mui/material';
import {
    DataGrid,
    GridCallbackDetails,
    GridCellEditCommitParams,
    MuiBaseEvent,
    MuiEvent,
} from '@mui/x-data-grid';
import { AxiosError } from 'axios';
import React, { MouseEvent, useContext, useState } from 'react';
import { IEditAnalysisConditions } from '../..';
import { GlobalContext, SnackbarType } from '../../../../../contexts/GlobalContext';
import useIsMounted from '../../../../../hooks/useIsMounted';
import API, { ConditionApiResponse } from '../../../../../utils/api';
import ConditionSelector from './ConditionSelector/ConditionSelector';
import EditAnalysisStyles from '../EditAnalysis.styles';

const EditAnalysisConditions: React.FC<IEditAnalysisConditions> = React.memo((props) => {
    const [originalDetails, setOriginalDetails] = useState({
        conditions: props.conditions,
        weights: props.weights,
    });
    const isMountedRef = useIsMounted();
    const { getAccessTokenSilently } = useAuth0();
    const context = useContext(GlobalContext);

    const [updatedEnabled, setUpdateEnabled] = useState(false);

    const handleUpdateConditions = async (event: MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        if (props.conditions && props.weights) {
            API.Services.AnalysesService.analysesIdPut(props.analysisId, {
                conditions: props.conditions.map((x) => x.id || ''),
                weights: props.weights,
            })
                .then((res) => {
                    if (isMountedRef.current) {
                        setUpdateEnabled(false);
                        context.showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                    }
                })
                .catch((err: Error | AxiosError) => {
                    context.showSnackbar('there was an error', SnackbarType.ERROR);
                    console.error(err.message);
                });
        }
    };

    const handleConditionSelected = (condition: ConditionApiResponse) => {
        const conditionExistsInTable =
            (props.conditions || []).findIndex(
                (analysisConditions) => analysisConditions.id === condition.id
            ) >= 0;

        if (conditionExistsInTable) {
            context.showSnackbar(
                'cannot add more than one of the same condition to an analysis',
                SnackbarType.WARNING
            );
            return;
        }

        if (props.conditions && props.weights) {
            const updatedConditions = [...props.conditions];
            const updatedWeights = [...props.weights];

            updatedConditions.push({ ...condition });
            updatedWeights.push(1);

            props.onConditionWeightChange(props.analysisId, updatedConditions, updatedWeights);
            setUpdateEnabled(true);
        }
    };

    const handleCellEditCommit = (
        params: GridCellEditCommitParams,
        _event: MuiEvent<MuiBaseEvent>,
        _details: GridCallbackDetails
    ) => {
        const conditionWeightToUpdateIndex = (props.conditions || []).findIndex(
            (condition) => params.id === condition.id
        );

        if (!props.conditions || !props.weights || conditionWeightToUpdateIndex < 0) {
            context.showSnackbar('there was an error updating the weight', SnackbarType.ERROR);
            return;
        }

        setUpdateEnabled(true);

        const updatedWeights = [...props.weights];
        // we are only updating weights, so it is safe to cast this to a number
        updatedWeights[conditionWeightToUpdateIndex] = params.value as number;

        props.onConditionWeightChange(props.analysisId, props.conditions, updatedWeights);
    };

    const conditionWeightsList = (props.conditions || []).map((condition, index) => ({
        id: condition.id,
        weight: (props.weights || [])[index] || 1,
        condition: condition.name,
    }));

    const handleDeleteCondition = (idToDelete: string) => {
        if (props.conditions && props.weights) {
            const indexToDelete = props.conditions.findIndex(
                (condition) => condition.id === idToDelete
            );

            if (indexToDelete >= 0) {
                const updatedConditions = [...props.conditions];
                const updatedWeights = [...props.weights];

                updatedConditions.splice(indexToDelete, 1);
                updatedWeights.splice(indexToDelete, 1);

                props.onConditionWeightChange(props.analysisId, updatedConditions, updatedWeights);
                setUpdateEnabled(true);
            }
        }
    };

    const handleRevertConditions = (_event: MouseEvent) => {
        props.onConditionWeightChange(
            props.analysisId,
            originalDetails.conditions as ConditionApiResponse[],
            originalDetails.weights as number[]
        );
    };

    return (
        <>
            <ConditionSelector onConditionSelected={handleConditionSelected} />

            <Box
                sx={{
                    '& .MuiDataGrid-root': {
                        borderColor: updatedEnabled ? '#ef8a24 !important' : 'lightgray',
                        borderWidth: '2px',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginBottom: '1rem',
                    }}
                >
                    <Typography variant="h6">Conditions for this analysis</Typography>

                    {updatedEnabled && (
                        <Typography color="secondary" variant="caption">
                            unsaved changes
                        </Typography>
                    )}
                </Box>

                {/* we get an error as we are doing display: block. This seems to be harmless */}
                <DataGrid
                    sx={{
                        '& .readonly': {
                            color: 'darkgray',
                            cursor: 'default',
                        },
                    }}
                    onCellEditCommit={handleCellEditCommit}
                    autoHeight
                    hideFooter={true}
                    rows={conditionWeightsList}
                    columns={[
                        {
                            field: 'condition',
                            headerName: 'Conditions',
                            flex: 2,
                            cellClassName: 'readonly',
                        },
                        {
                            field: 'weight',
                            headerName: 'Weights',
                            flex: 1,
                            editable: true,
                            headerAlign: 'left',
                            align: 'left',
                            type: 'number',
                        },
                        {
                            field: 'action',
                            headerName: 'Actions',
                            width: 100,
                            editable: false,
                            renderCell: (params) => {
                                return (
                                    <>
                                        <Button
                                            color="error"
                                            onClick={(_event) =>
                                                handleDeleteCondition(params.id as string)
                                            }
                                        >
                                            Delete
                                        </Button>
                                    </>
                                );
                            },
                        },
                    ]}
                />
            </Box>

            <Box sx={{ marginTop: '1rem' }}>
                <Button
                    sx={[EditAnalysisStyles.analysisButton, { marginRight: '15px' }]}
                    variant="contained"
                    color="success"
                    disabled={!updatedEnabled}
                    onClick={handleUpdateConditions}
                >
                    Update
                </Button>
                <Button
                    sx={EditAnalysisStyles.analysisButton}
                    variant="outlined"
                    color="secondary"
                    disabled={!updatedEnabled}
                    onClick={handleRevertConditions}
                >
                    Cancel
                </Button>
            </Box>
        </>
    );
});

export default EditAnalysisConditions;
