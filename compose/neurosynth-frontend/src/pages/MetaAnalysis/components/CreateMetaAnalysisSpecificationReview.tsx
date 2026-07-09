import { Box, Button, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateAlgorithmSpecification, useGetAnnotationById } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import DynamicInputDisplay from 'pages/MetaAnalysis/components/DynamicInputDisplay';
import { getFilteredAnnotationNotes } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.helpers';
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
            <Box
                sx={{
                    maxHeight: '55vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 6,
                }}
            >
                <Typography color="primary.dark">Details</Typography>
                <Box>
                    <Typography variant="body1">{props.details.name}</Typography>
                    <Typography variant="body2">{props.details.description}</Typography>
                </Box>

                <Typography color="primary.dark">Selection</Typography>
                <Box>
                    <Typography variant="body1">{selectionText}</Typography>
                    <Typography variant="body2">{numSelectedAnnotationsText}</Typography>
                    {props.selection.referenceDataset && (
                        <Typography variant="body2" sx={{ marginTop: '1rem', color: 'gray' }}>
                            Reference Dataset: {props.selection.referenceDataset}
                        </Typography>
                    )}
                </Box>

                <Typography color="primary.dark">Estimator</Typography>
                <Box>
                    <Typography variant="body1">{props.algorithm.estimator?.label || ''}</Typography>
                    <Typography variant="body2">{props.algorithm.estimator?.description || ''}</Typography>
                    {Object.keys(props.algorithm.estimatorArgs).length > 0 ? (
                        <DynamicInputDisplay dynamicArg={props.algorithm.estimatorArgs} />
                    ) : (
                        <></>
                    )}
                </Box>

                {props.algorithm.corrector && (
                    <>
                        <Typography color="primary.dark">Corrector</Typography>
                        <Box>
                            <Typography variant="body1">{props.algorithm.corrector?.label || ''}</Typography>
                            <Typography variant="body2">{props.algorithm.corrector?.description || ''}</Typography>
                            {Object.keys(props.algorithm.correctorArgs).length > 0 ? (
                                <DynamicInputDisplay dynamicArg={props.algorithm.correctorArgs} />
                            ) : (
                                <></>
                            )}
                        </Box>
                    </>
                )}
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
