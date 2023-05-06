import { Box, Typography } from '@mui/material';
import { EPropertyType, getType } from 'components/EditMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSpecificationById from 'hooks/requests/useGetSpecificationById';
import { AnnotationReturn, SpecificationReturn } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';
import SelectAnalysesComponent from '../CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent';
import SelectSpecificationComponent from '../CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationAlgorithmStep/SelectSpecificationComponent/SelectSpecificationComponent';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import useUpdateSpecification from 'hooks/requests/useUpdateSpecification';
import { EAnalysisType } from 'hooks/requests/useCreateAlgorithmSpecification';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const EditSpecificationDialog: React.FC<IDialog> = (props) => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const {
        data: specification,
        isLoading: getMetaAnalysisIsLoading,
        isError: getMetaAnalysisIsError,
    } = useGetSpecificationById((metaAnalysis?.specification as SpecificationReturn)?.id);
    const {
        mutate,
        isLoading: updateSpecificationIsLoading,
        isError: updateSpecificationIsError,
    } = useUpdateSpecification();
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
    }, [specification]);

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
                        margin: '0 2rem',
                    }}
                >
                    <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                        Edit Algorithm:
                    </Typography>
                    <SelectSpecificationComponent
                        algorithm={algorithmSpec}
                        onSelectSpecification={(update) => setAlgorithmSpec(update)}
                    />
                    <Typography
                        sx={{ marginBottom: '1rem', fontWeight: 'bold', marginTop: '5rem' }}
                        gutterBottom
                    >
                        Edit Analyses Selection:
                    </Typography>
                    <SelectAnalysesComponent
                        annotationdId={
                            (metaAnalysis?.annotation as AnnotationReturn)?.neurostore_id || ''
                        }
                        selectedValue={selectedValue}
                        onSelectValue={(update) => setSelectedValue(update)}
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            position: 'sticky',
                            backgroundColor: 'white',
                            padding: '10px 0',
                            bottom: 0,
                        }}
                    >
                        <LoadingButton
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
