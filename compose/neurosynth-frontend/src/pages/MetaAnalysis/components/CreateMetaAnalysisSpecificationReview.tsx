import { Box, Button, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import MetaAnalysisSummaryRow from 'pages/MetaAnalysis/components/MetaAnalysisSummaryRow';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateAlgorithmSpecification, useGetAnnotationById } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectMetaAnalyses,
    useUpdateProjectMetaAnalyses,
} from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IAlgorithmSelection, IAnalysesSelection } from './CreateMetaAnalysisSpecificationDialogBase.types';
import { getWeightAndConditionsForSpecification } from './CreateMetaAnalysisSpecificationReview.helpers';
import DynamicInputDisplay from 'pages/MetaAnalysis/components/DynamicInputDisplay';
import { getFilteredAnnotationNotes } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.helpers';

const triggerAppziFeedbackPopup = () => {
    const windowAppziObj = (window as any).appzi;
    const alreadyPrompted = localStorage.getItem('APPZI_FEEDBACK_PROMPTED') === 'true';
    if (windowAppziObj && !alreadyPrompted) {
        localStorage.setItem('APPZI_FEEDBACK_PROMPTED', 'true');
        windowAppziObj.openSurvey('03c0bd6a-d53d-4457-aae4-64d3cbc346d1');
    }
};

const CreateMetaAnalysisSpecificationReview: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onClose: () => void;
    selection: IAnalysesSelection;
    algorithm: IAlgorithmSelection;
    details: {
        name: string;
        description: string;
    };
}> = (props) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotations } = useGetAnnotationById(annotationId);
    const { createMetaAnalysis, isLoading, isError } = useCreateAlgorithmSpecification();
    const { enqueueSnackbar } = useSnackbar();
    const projectMetaAnalyses = useProjectMetaAnalyses() || [];
    const updateProjectMetaAnalyses = useUpdateProjectMetaAnalyses();

    // TODO: implement studyset snapshot
    // const [showAdvanced, setShowAdvanced] = useState(false);

    const handleCreateSpecification = async () => {
        if (!props.algorithm?.estimator?.label || !props.selection?.selectionKey) return;
        if (!props.selection || !props.selection.selectionValue) return;

        const { weights, conditions, databaseStudyset } = getWeightAndConditionsForSpecification(
            props.algorithm.estimator,
            props.selection
        );

        const metaAnalysis = await createMetaAnalysis(
            projectId,
            EAnalysisType.CBMA,
            props.algorithm.estimator,
            props.algorithm.corrector,
            studysetId,
            annotationId,
            props.selection?.selectionKey,
            props.details.name,
            props.details.description,
            props.algorithm.estimatorArgs,
            props.algorithm.correctorArgs,
            conditions,
            weights,
            databaseStudyset
        );
        if (!metaAnalysis.data.specification || !metaAnalysis.data.id)
            throw new Error('no specification ID found when creating a meta-analysis');

        // Ensure that metaAnalysis.data.id is a string
        if (typeof metaAnalysis.data.id !== 'string') {
            throw new Error('metaAnalysis.data.id must be a string');
        }
        const updatedMetaAnalyses = [...(projectMetaAnalyses as string[]), metaAnalysis.data.id] as string[];
        // Update the project meta analyses
        updateProjectMetaAnalyses(updatedMetaAnalyses);

        enqueueSnackbar('created meta analysis specification successfully', {
            variant: 'success',
        });

        navigate(`/projects/${projectId}/meta-analyses/${metaAnalysis.data.id}`);

        triggerAppziFeedbackPopup();
    };

    const numSelectedAnnotationsText = useMemo(() => {
        const selectedAnnotations = getFilteredAnnotationNotes(
            (annotations?.notes || []) as NoteCollectionReturn[],
            props.selection
        );
        const totalNumAnnotations = (annotations?.notes || []).length;
        return `${selectedAnnotations.length} / ${totalNumAnnotations} analyses selected`;
    }, [annotations?.notes, props.selection]);

    const selectionText = useMemo(() => {
        if (!props.selection) return '';
        const selectionKey = props.selection.selectionKey;
        const selectionValue = props.selection.selectionValue ? `: ${props.selection.selectionValue}` : '';
        return `${selectionKey} ${selectionValue}`;
    }, [props.selection]);

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
                <MetaAnalysisSummaryRow title="Selection" value={selectionText} caption={numSelectedAnnotationsText}>
                    {props.selection.referenceDataset && (
                        <>
                            <Typography sx={{ marginTop: '1rem', color: 'gray' }}>
                                Reference Dataset: {props.selection.referenceDataset}
                            </Typography>
                        </>
                    )}
                </MetaAnalysisSummaryRow>
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
                {/* <Box>
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
                </Box> */}
            </Box>
            <Box sx={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => props.onNavigate(ENavigationButton.PREV)} color="primary" variant="outlined">
                    Back
                </Button>
                <LoadingButton
                    variant="contained"
                    sx={{ width: '350px' }}
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
