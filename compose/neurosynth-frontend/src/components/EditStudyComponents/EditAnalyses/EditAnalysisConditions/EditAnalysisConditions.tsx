import { Button } from '@mui/material';
import {
    DataGrid,
    GridCallbackDetails,
    GridCellEditCommitParams,
    GridEventListener,
    MuiBaseEvent,
    MuiEvent,
} from '@mui/x-data-grid';
import React from 'react';
import ConditionSelector from './ConditionSelector/ConditionSelector';
import EditAnalysisConditionsStyles from './EditAnalysisConditions.styles';
import {
    IStoreCondition,
    useAddOrUpdateConditionWeightPairForAnalysis,
    useDeleteConditionFromAnalysis,
    useStudyAnalysisConditions,
    useStudyAnalysisWeights,
} from 'pages/Studies/StudyStore';
import { useSnackbar } from 'notistack';

const EditAnalysisConditions: React.FC<{ analysisId: string }> = React.memo((props) => {
    const conditions = useStudyAnalysisConditions(props.analysisId);
    const weights = useStudyAnalysisWeights(props.analysisId);

    const addOrUpdateConditionWeightPairForAnalysis =
        useAddOrUpdateConditionWeightPairForAnalysis();
    const deleteConditionFromAnalysis = useDeleteConditionFromAnalysis();
    const { enqueueSnackbar } = useSnackbar();

    const handleConditionSelected = (condition: IStoreCondition) => {
        if (!props.analysisId) return;

        const conditionExistsInTable =
            (conditions || []).findIndex(
                (analysisConditions) => analysisConditions.id === condition.id
            ) >= 0;

        if (conditionExistsInTable) {
            enqueueSnackbar('cannot add more than one of the same condition to an analysis', {
                variant: 'warning',
            });
            return;
        }

        addOrUpdateConditionWeightPairForAnalysis(props.analysisId, condition, 1);
    };

    const handleCellEditCommit: GridEventListener<'cellEditCommit'> = (
        params: GridCellEditCommitParams,
        _event: MuiEvent<MuiBaseEvent>,
        _details: GridCallbackDetails
    ) => {
        if (!props.analysisId) return;
        const conditionIndex = conditions.findIndex((x) => x.id === params.id);
        if (conditionIndex < 0) return;
        addOrUpdateConditionWeightPairForAnalysis(
            props.analysisId,
            conditions[conditionIndex],
            params.value as number
        );
    };

    const handleDeleteCondition = (conditionId: string) => {
        if (!props.analysisId) return;

        deleteConditionFromAnalysis(props.analysisId, conditionId);
    };

    const conditionWeightsList = (conditions || []).map((condition, index) => ({
        id: condition.id || `${index}`,
        weight: (weights || [])[index] || 1,
        condition: condition.name || '',
    }));

    return (
        <>
            <ConditionSelector onConditionSelected={handleConditionSelected} />

            <DataGrid
                sx={[
                    EditAnalysisConditionsStyles.datagrid,
                    {
                        height: conditionWeightsList.length === 0 ? '112px !important' : 'auto',
                        marginTop: '1rem',
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
                        flex: 1,
                        editable: false,
                        cellClassName: 'readonly',
                    },
                    {
                        field: 'weight',
                        headerName: 'Weights',
                        flex: 2,
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
