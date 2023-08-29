import { Box, Typography } from '@mui/material';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import SelectAnalysesSummaryComponent from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesSummaryComponent/SelectAnalysesSummaryComponent';
import { EPropertyType, getType } from 'components/EditMetadata';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysisById } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useUpdateSpecification from 'hooks/metaAnalyses/useUpdateSpecification';
import {
    AnnotationReturn,
    SpecificationReturn,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';
import SelectSpecificationComponent from '../CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationAlgorithmStep/SelectSpecificationComponent/SelectSpecificationComponent';
import SelectAnalysesComponent from '../CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent';

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
    const [selectedValue, setSelectedValue] = useState<
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined
    >({
        selectionKey: specification?.filter || undefined,
        type: getType(specification?.filter),
    });

    const [algorithmSpec, setAlgorithmSpec] = useState<{
        estimator: IAutocompleteObject | null;
        corrector: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        correctorArgs: IDynamicValueType;
    }>({
        estimator: null,
        corrector: null,
        estimatorArgs: {},
        correctorArgs: {},
    });

    useEffect(() => {
        setSelectedValue({
            selectionKey: specification?.filter || undefined,
            type: getType(specification?.filter),
        });

        const estimator = specification?.estimator?.type
            ? {
                  label: specification.estimator.type,
                  description:
                      metaAnalysisSpecification.CBMA[specification?.estimator?.type].summary,
              }
            : null;
        const corrector = specification?.corrector?.type
            ? {
                  label: specification.corrector.type,
                  description:
                      metaAnalysisSpecification.CORRECTOR[specification.corrector.type].summary,
              }
            : null;
        setAlgorithmSpec({
            estimator: estimator,
            corrector: corrector,
            estimatorArgs:
                (specification?.estimator?.args as { [key: string]: any } | undefined) || {},
            correctorArgs:
                (specification?.corrector?.args as { [key: string]: any } | undefined) || {},
        });
    }, [specification, props.isOpen]); // add isOpen so that on close/open, the selected val, estimator & corrector are reset

    const handleUpdateSpecification = () => {
        if (!specification?.id || !algorithmSpec.estimator?.label || !selectedValue?.selectionKey)
            return;

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
                },
            },
            {
                onSuccess: () => {
                    props.onCloseDialog();
                },
            }
        );
    };

    const disable = !algorithmSpec.estimator || !selectedValue?.selectionKey;

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
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading}
                isError={getMetaAnalysisIsError}
            >
                <Box
                    sx={{
                        margin: '1rem 2rem',
                    }}
                >
                    <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }} gutterBottom>
                        Edit Analyses Selection:
                    </Typography>
                    <SelectAnalysesComponent
                        annotationdId={
                            (metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id || ''
                        }
                        selectedValue={selectedValue}
                        onSelectValue={(update) => setSelectedValue(update)}
                    />

                    <Typography sx={{ fontWeight: 'bold', marginTop: '3rem' }} gutterBottom>
                        Edit Algorithm:
                    </Typography>
                    <SelectSpecificationComponent
                        algorithm={algorithmSpec}
                        onSelectSpecification={(update) => setAlgorithmSpec(update)}
                    />

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            position: 'sticky',
                            backgroundColor: 'white',
                            padding: '10px 0',
                            bottom: 0,
                            alignItems: 'center',
                            zIndex: 99,
                        }}
                    >
                        {/* empty div used for equally spacing and centering components */}
                        <Box>
                            <SelectAnalysesSummaryComponent
                                studysetId={
                                    (metaAnalysis?.studyset as StudysetReturn)?.neurostore_id || ''
                                }
                                annotationdId={
                                    (metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id ||
                                    ''
                                }
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
                            disabled={disable}
                            onClick={handleUpdateSpecification}
                        />
                    </Box>
                </Box>
            </StateHandlerComponent>
        </BaseDialog>
    );
};

export default EditSpecificationDialog;
