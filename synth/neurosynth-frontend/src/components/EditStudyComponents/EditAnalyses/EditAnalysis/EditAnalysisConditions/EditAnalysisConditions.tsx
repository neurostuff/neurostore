import { Box, Typography, Button } from '@mui/material';
import {
    DataGrid,
    GridCallbackDetails,
    GridCellEditCommitParams,
    MuiBaseEvent,
    MuiEvent,
} from '@mui/x-data-grid';
import React from 'react';
import { IEditAnalysisConditions } from '../..';
import ConditionSelector from './ConditionSelector/ConditionSelector';
import EditAnalysisConditionsStyles from './EditAnalysisConditions.styles';
import { useUpdateAnalysis } from 'hooks';
import { ConditionReturn } from 'neurostore-typescript-sdk';
import { useIsFetching } from 'react-query';
import { useSnackbar } from 'notistack';

const EditAnalysisConditions: React.FC<IEditAnalysisConditions> = React.memo((props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { isLoading, mutate, isError } = useUpdateAnalysis();
    const isFetching = useIsFetching(['studies', props.studyId]);

    const handleConditionSelected = (condition: ConditionReturn) => {
        const conditionExistsInTable =
            (props.conditions || []).findIndex(
                (analysisConditions) => analysisConditions.id === condition.id
            ) >= 0;

        if (conditionExistsInTable) {
            enqueueSnackbar('cannot add more than one of the same condition to an analysis', {
                variant: 'warning',
            });
            return;
        }

        if (props.conditions && props.weights) {
            const updatedConditions = [...props.conditions].map((x) => x?.id || '');
            const updatedWeights = [...props.weights];

            mutate({
                analysisId: props.analysisId,
                analysis: {
                    conditions: [...updatedConditions, condition.id || ''],
                    weights: [...updatedWeights, 1],
                },
            });
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
            enqueueSnackbar('there was an error updating the weight', {
                variant: 'error',
            });
            return;
        }

        const updatedWeights = [...props.weights];
        // we are only updating weights, so it is safe to cast this to a number
        updatedWeights[conditionWeightToUpdateIndex] = params.value as number;

        mutate({
            analysisId: props.analysisId,
            analysis: {
                conditions: [...props.conditions].map((x) => x.id || ''),
                weights: updatedWeights,
            },
        });
    };

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

                mutate({
                    analysisId: props.analysisId,
                    analysis: {
                        conditions: updatedConditions.map((x) => x.id || ''),
                        weights: updatedWeights,
                    },
                });
            }
        }
    };

    const conditionWeightsList = (props.conditions || []).map((condition, index) => ({
        id: condition.id,
        weight: (props.weights || [])[index] || 1,
        condition: condition.name,
    }));

    return (
        <>
            <ConditionSelector onConditionSelected={handleConditionSelected} />

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    margin: '1rem 0',
                }}
            >
                <Typography variant="h6">Conditions for this analysis</Typography>
            </Box>

            <DataGrid
                error={isError ? true : undefined}
                loading={isLoading || isFetching > 0}
                sx={[
                    EditAnalysisConditionsStyles.datagrid,
                    {
                        height: conditionWeightsList.length === 0 ? '112px !important' : 'auto',
                    },
                ]}
                showCellRightBorder
                disableVirtualization
                onCellEditCommit={handleCellEditCommit}
                autoHeight
                hideFooter={true}
                rows={conditionWeightsList}
                columns={[
                    {
                        field: 'condition',
                        headerName: 'Conditions',
                        flex: 2,
                        editable: false,
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
                        valueFormatter: (value) => value.value,
                    },
                    {
                        field: 'action',
                        headerName: 'Actions',
                        width: 90,
                        editable: false,
                        renderCell: (params: any) => (
                            <Button
                                color="error"
                                onClick={(_event) => handleDeleteCondition(params.id as string)}
                            >
                                delete
                            </Button>
                        ),
                    },
                ]}
            />
        </>
    );
});

export default EditAnalysisConditions;
