import {
    Box,
    Button,
    Divider,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Typography,
} from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import DynamicInputDisplay from 'components/MetaAnalysisConfigComponents/DynamicInputDisplay/DynamicInputDisplay';
import MetaAnalysisSummaryRow from 'components/MetaAnalysisConfigComponents/MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateAlgorithmSpecification, useGetAnnotationById } from 'hooks';
import { EAnalysisType } from 'hooks/requests/useCreateAlgorithmSpecification';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useHistory } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { getFilteredAnnotationNotes } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent';

const CreateMetaAnalysisSpecificationReview: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onClose: () => void;
    selection:
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined;
    algorithm: {
        estimator: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        corrector: IAutocompleteObject | null;
        correctorArgs: IDynamicValueType;
    };
    details: {
        name: string;
        description: string;
    };
}> = (props) => {
    const history = useHistory();
    const projectId = useProjectId();
    const projectName = useProjectName();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotations } = useGetAnnotationById(annotationId);
    const { createMetaAnalysis, isLoading, isError } = useCreateAlgorithmSpecification();
    const { enqueueSnackbar } = useSnackbar();
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleCreateSpecification = async () => {
        if (props.algorithm?.estimator?.label && props.selection?.selectionKey) {
            const metaAnalysis = await createMetaAnalysis(
                projectId,
                EAnalysisType.CBMA,
                props.algorithm.estimator,
                props.algorithm.corrector,
                studysetId,
                annotationId,
                props.selection?.selectionKey,
                `${projectName} Meta Analysis`,
                '',
                props.algorithm.estimatorArgs,
                props.algorithm.correctorArgs
            );
            if (!metaAnalysis.data.specification || !metaAnalysis.data.id)
                throw new Error('no specification ID found when creating a meta-analysis');

            enqueueSnackbar('created meta analysis specification successfully', {
                variant: 'success',
            });
            history.push(`/projects/${projectId}/meta-analyses/${metaAnalysis.data.id}`);
        }
    };

    const selectedAnnotations = getFilteredAnnotationNotes(
        (annotations?.notes || []) as NoteCollectionReturn[],
        props.selection?.selectionKey
    );

    return (
        <StateHandlerComponent
            isError={isError}
            isLoading={false}
            errorMessage="There was an error creating the meta-analysis specification. Please report this issue to us using the feedback tab in the bottom right."
        >
            <Box sx={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
                <MetaAnalysisSummaryRow
                    title="Details"
                    value={props.details.name}
                    caption={props.details.description}
                />
                <MetaAnalysisSummaryRow
                    title="Selection"
                    value={props.selection?.selectionKey || ''}
                    caption={`${selectedAnnotations.length} / ${
                        (annotations?.notes || []).length
                    } analyses selected`}
                ></MetaAnalysisSummaryRow>
                <MetaAnalysisSummaryRow
                    title="Estimator"
                    value={props.algorithm.estimator?.label || ''}
                    caption={props.algorithm.estimator?.description || ''}
                >
                    {Object.keys(props.algorithm.estimatorArgs).length > 0 ? (
                        <DynamicInputDisplay dynamicArg={props.algorithm.estimatorArgs} />
                    ) : (
                        <></>
                    )}
                </MetaAnalysisSummaryRow>
                {props.algorithm.corrector && (
                    <MetaAnalysisSummaryRow
                        title="Corrector"
                        value={props.algorithm.corrector?.label || ''}
                        caption={props.algorithm.corrector?.description || ''}
                    >
                        {Object.keys(props.algorithm.correctorArgs).length > 0 ? (
                            <DynamicInputDisplay dynamicArg={props.algorithm.correctorArgs} />
                        ) : (
                            <></>
                        )}
                    </MetaAnalysisSummaryRow>
                )}
                <Box>
                    <Button color="info" onClick={() => setShowAdvanced((prev) => !prev)}>
                        {showAdvanced ? 'hide' : 'show'} advanced
                    </Button>
                    {showAdvanced && (
                        <Box>
                            <Divider sx={{ marginBottom: '1rem' }} />

                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                Select Studyset Snapshot
                            </Typography>
                            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                                Select the snapshot of your studyset that you want to use for your
                                meta-analysis.{' '}
                                <b>Most of the time, you'll want to select "latest"</b>
                            </Typography>
                            <FormControl>
                                <InputLabel>Snapshot Version</InputLabel>
                                <Select
                                    label="Studyset Snapshot"
                                    sx={{ width: '300px' }}
                                    value="1"
                                    size="small"
                                >
                                    <MenuItem value="1">latest</MenuItem>
                                    <MenuItem value="2">2023-04-28T20:49:42+00:00</MenuItem>
                                    <MenuItem value="3">2023-04-28T20:49:42+00:00</MenuItem>
                                    <MenuItem value="4">2023-04-28T20:49:42+00:00</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    )}
                </Box>
            </Box>
            <Box sx={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    onClick={() => props.onNavigate(ENavigationButton.PREV)}
                    color="primary"
                    variant="outlined"
                >
                    Back
                </Button>
                <LoadingButton
                    variant="contained"
                    sx={{ width: '303px' }}
                    color="success"
                    isLoading={isLoading}
                    onClick={handleCreateSpecification}
                    loaderColor="secondary"
                    text="Create Meta-Analysis Specification"
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default CreateMetaAnalysisSpecificationReview;
