import { Box, Typography } from '@mui/material';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import LoadingButton from 'components/Buttons/LoadingButton';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';

import { IMetaAnalysisParamsSpecification } from 'pages/MetaAnalysis/components/DynamicForm.types';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysisById } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useUpdateSpecification from 'hooks/metaAnalyses/useUpdateSpecification';
import { AnnotationReturn, SpecificationReturn, StudysetReturn } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getType } from 'components/EditMetadata/EditMetadata.types';
import {
    IAnalysesSelection,
    IAlgorithmSelection,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import { getWeightAndConditionsForSpecification } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationReview.helpers';
import CreateMetaAnalysisSpecificationSelectionStepMultiGroup from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationSelectionStepMultiGroup';
import SelectSpecificationComponent from 'pages/MetaAnalysis/components/MetaAnalysisSelectSpecificationComponent';
import SelectAnalysesComponent from 'pages/MetaAnalysis/components/SelectAnalysesComponent';
import { isMultiGroupAlgorithm } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.helpers';
import SelectAnalysesSummaryComponent from 'pages/MetaAnalysis/components/SelectAnalysesSummaryComponent';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const EditSpecificationDialog: React.FC<IDialog> = (props) => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const {
        data: specification,
        isLoading: getMetaAnalysisIsLoading,
        isError: getMetaAnalysisIsError,
    } = useGetSpecificationById((metaAnalysis?.specification as SpecificationReturn)?.id);
    const { mutate, isLoading: updateSpecificationIsLoading } = useUpdateSpecification();
    const [selectedValue, setSelectedValue] = useState<IAnalysesSelection>({
        selectionKey: specification?.filter || undefined,
        type: getType(specification?.conditions?.[0]),
        selectionValue: specification?.conditions?.[0],
        referenceDataset: specification?.database_studyset || undefined,
    });

    const [algorithmSpec, setAlgorithmSpec] = useState<IAlgorithmSelection>({
        estimator: null,
        corrector: null,
        estimatorArgs: {},
        correctorArgs: {},
    });

    useEffect(() => {
        if (!specification?.filter) return;

        setSelectedValue({
            selectionKey: specification.filter,
            type: getType(specification?.conditions?.[0]),
            selectionValue: (specification.conditions || [])[0],
            referenceDataset:
                specification?.conditions?.[1] !== undefined
                    ? specification.conditions[1].toString()
                    : specification?.database_studyset || undefined,
        });

        const estimator = specification?.estimator?.type
            ? {
                  label: specification.estimator.type,
                  description: metaAnalysisSpecification.CBMA[specification?.estimator?.type].summary,
              }
            : null;
        const corrector = specification?.corrector?.type
            ? {
                  label: specification.corrector.type,
                  description: metaAnalysisSpecification.CORRECTOR[specification.corrector.type].summary,
              }
            : null;
        setAlgorithmSpec({
            estimator: estimator,
            corrector: corrector,
            estimatorArgs: (specification?.estimator?.args as { [key: string]: any } | undefined) || {},
            correctorArgs: (specification?.corrector?.args as { [key: string]: any } | undefined) || {},
        });
    }, [specification, props.isOpen]); // add isOpen so that on close/open, the selected val, estimator & corrector are reset

    const handleUpdateSpecification = () => {
        if (
            !specification?.id ||
            !algorithmSpec.estimator?.label ||
            !selectedValue?.selectionKey ||
            !selectedValue?.selectionValue
        )
            return;

        const { weights, conditions, databaseStudyset } = getWeightAndConditionsForSpecification(
            algorithmSpec.estimator,
            selectedValue
        );
        mutate(
            {
                specificationId: specification.id,
                specification: {
                    type: EAnalysisType.CBMA,
                    estimator: {
                        type: algorithmSpec.estimator.label,
                        args: algorithmSpec.estimatorArgs,
                    },
                    corrector: algorithmSpec.corrector
                        ? {
                              type: algorithmSpec.corrector.label,
                              args: algorithmSpec.correctorArgs,
                          }
                        : null,
                    filter: selectedValue.selectionKey,
                    conditions,
                    database_studyset: databaseStudyset,
                    weights,
                },
            },
            {
                onSuccess: () => {
                    props.onCloseDialog();
                },
            }
        );
    };

    const isMultiGroup = isMultiGroupAlgorithm(algorithmSpec.estimator);

    const disabled = useMemo(() => {
        const isMultiGroup = isMultiGroupAlgorithm(algorithmSpec.estimator);
        return (
            !selectedValue?.selectionKey ||
            selectedValue?.selectionValue === undefined ||
            (isMultiGroup && !selectedValue?.referenceDataset)
        );
    }, [
        algorithmSpec.estimator,
        selectedValue?.referenceDataset,
        selectedValue?.selectionKey,
        selectedValue?.selectionValue,
    ]);

    return (
        <BaseDialog
            dialogTitle="Edit Meta-Analysis Specification"
            isOpen={props.isOpen}
            onCloseDialog={props.onCloseDialog}
            fullWidth
            dialogTitleSx={{ margin: '0 2rem' }}
            dialogContentSx={{ paddingBottom: '0' }}
            maxWidth="lg"
        >
            <StateHandlerComponent isLoading={getMetaAnalysisIsLoading} isError={getMetaAnalysisIsError}>
                <Box sx={{ margin: '0rem 2rem' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }} gutterBottom>
                        Edit Algorithm:
                    </Typography>
                    <SelectSpecificationComponent
                        algorithm={algorithmSpec}
                        onSelectSpecification={(update) => setAlgorithmSpec(update)}
                    />

                    <Typography variant="h6" sx={{ marginBottom: '1rem', marginTop: '1rem' }} gutterBottom>
                        Edit Analyses Selection:
                    </Typography>
                    <SelectAnalysesComponent
                        annotationId={(metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id || ''}
                        selectedValue={selectedValue}
                        onSelectValue={(update) => {
                            setSelectedValue(update);
                        }}
                        algorithm={algorithmSpec}
                    />
                    {isMultiGroup && (
                        <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                            onSelectValue={(newVal) => setSelectedValue(newVal)}
                            annotationId={(metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id || ''}
                            selectedValue={selectedValue}
                            algorithm={algorithmSpec}
                        />
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        position: 'sticky',
                        backgroundColor: 'white',
                        padding: '10px 2rem',
                        bottom: 0,
                        alignItems: 'center',
                        zIndex: 99,
                        marginBottom: '1rem',
                    }}
                >
                    {/* empty div used for equally spacing and centering components */}
                    <Box>
                        <SelectAnalysesSummaryComponent
                            studysetId={(metaAnalysis?.studyset as StudysetReturn)?.neurostore_id || ''}
                            annotationdId={(metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id || ''}
                            selectedValue={selectedValue}
                        />
                    </Box>
                    <LoadingButton
                        disableElevation
                        variant="contained"
                        text="Update"
                        sx={{ width: '86px' }}
                        loaderColor="secondary"
                        isLoading={updateSpecificationIsLoading}
                        disabled={disabled}
                        onClick={handleUpdateSpecification}
                    />
                </Box>
            </StateHandlerComponent>
        </BaseDialog>
    );
};

export default EditSpecificationDialog;
