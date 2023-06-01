import { useAuth0 } from '@auth0/auth0-react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Help from '@mui/icons-material/Help';
import { Box, Button, IconButton, Link, Paper, Typography } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import SelectAnalysesSummaryComponent from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesSummaryComponent/SelectAnalysesSummaryComponent';
import EditSpecificationDialog from 'components/Dialogs/EditSpecificationDialog/EditSpecificationDialog';
import { getType } from 'components/EditMetadata';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import DynamicInputDisplay from 'components/MetaAnalysisConfigComponents/DynamicInputDisplay/DynamicInputDisplay';
import MetaAnalysisSummaryRow from 'components/MetaAnalysisConfigComponents/MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSpecificationById from 'hooks/requests/useGetSpecificationById';
import useUpdateMetaAnalysis from 'hooks/requests/useUpdateMetaAnalysis';
import useGetTour from 'hooks/useGetTour';
import {
    Annotation,
    ResultReturn,
    Specification,
    SpecificationReturn,
    Studyset,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import { useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { NeurostoreAnnotation } from 'utils/api';
import MetaAnalysisPageStyles from './MetaAnalysisPage.styles';
import { EAnalysisType } from 'hooks/requests/useCreateAlgorithmSpecification';
import useGetMetaAnalysisResultById from 'hooks/requests/useGetMetaAnalysisResultById';
import DisplayMetaAnalysisResult from 'components/DisplayMetaAnalysisResult/DisplayMetaAnalysisResult';

const getAnalysisTypeDescription = (name: string | undefined): string => {
    switch (name) {
        case EAnalysisType.CBMA:
            return 'Coordinate Based Meta-Analysis';
        case EAnalysisType.IBMA:
            return 'Image Based Meta-Analysis';
        default:
            return '';
    }
};

const MetaAnalysisPage: React.FC = (props) => {
    const { startTour } = useGetTour('MetaAnalysisPage');
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const { user } = useAuth0();

    const projectName = useProjectName();

    /**
     * We need to use two separate instances of the same hook so that it only shows
     * the name loading when we update the name, and only the description loading when
     * we update the description
     */
    const { mutate: updateMetaAnalysisName, isLoading: updateMetaAnalysisNameIsLoading } =
        useUpdateMetaAnalysis();

    const {
        mutate: updateMetaAnalysisDescription,
        isLoading: updateMetaAnalysisDescriptionIsLoading,
    } = useUpdateMetaAnalysis();

    const {
        data: metaAnalysis,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);
    const { data: metaAnalysisResult, isLoading: getMetaAnalysisResultIsLoading } =
        useGetMetaAnalysisResultById(
            metaAnalysis?.results && metaAnalysis.results.length
                ? (metaAnalysis.results[metaAnalysis.results.length - 1] as ResultReturn).id
                : undefined
        );

    const { data: specification } = useGetSpecificationById(
        (metaAnalysis?.specification as SpecificationReturn | undefined)?.id
    );

    // get request is set to nested: true so below casting is safe
    const studyset = metaAnalysis?.studyset as StudysetReturn;
    const annotation = metaAnalysis?.annotation as NeurostoreAnnotation;

    const thisUserOwnsThisMetaAnalysis = (metaAnalysis?.user || undefined) === (user?.sub || null);
    const viewingThisPageFromProject = !!projectId;

    const [editSpecificationDialogIsOpen, setEditSpecificationDialogIsOpen] = useState(false);

    const updateName = (updatedName: string, _label: string) => {
        if (metaAnalysis?.id && specification?.id && studyset?.id && annotation?.id) {
            updateMetaAnalysisName({
                metaAnalysisId: metaAnalysis.id,
                metaAnalysis: {
                    name: updatedName,
                },
            });
        }
    };

    const updateDescription = (updatedDescription: string, _label: string) => {
        if (metaAnalysis?.id && specification?.id && studyset?.id && annotation?.id) {
            updateMetaAnalysisDescription({
                metaAnalysisId: metaAnalysis.id,
                metaAnalysis: {
                    description: updatedDescription,
                },
            });
        }
    };

    const metaAnalysisDisplayObj = {
        name: metaAnalysis?.name || '',
        description: metaAnalysis?.description || '',
        analysisType: (metaAnalysis?.specification as Specification)?.type || '',
        analysisTypeDescription: getAnalysisTypeDescription(
            (metaAnalysis?.specification as Specification)?.type
        ),
        studyset: (metaAnalysis?.studyset as Studyset)?.neurostore_id || '',
        annotation: (metaAnalysis?.annotation as Annotation)?.neurostore_id || '',
        inclusionColumn: specification?.filter || '',
        inclusionColumnType: getType(specification?.filter || ''),
        estimator: specification?.estimator?.type || '',
        estimatorArgs: (specification?.estimator?.args || {}) as IDynamicValueType,
        corrector: specification?.corrector?.type || '',
        correctorArgs: (specification?.corrector?.args || {}) as IDynamicValueType,
    };

    return (
        <>
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading || getMetaAnalysisResultIsLoading}
                isError={getMetaAnalysisIsError}
                errorMessage="There was an error getting your meta-analysis"
            >
                {viewingThisPageFromProject && (
                    <Box sx={{ marginBottom: '1rem' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    link: '/projects',
                                    text: 'Projects',
                                    isCurrentPage: false,
                                },
                                {
                                    link: `/projects/${projectId}/meta-analyses`,
                                    text: `${projectName}`,
                                    isCurrentPage: false,
                                },
                                {
                                    link: '',
                                    text: metaAnalysis?.name || '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                    </Box>
                )}

                <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                    <Box sx={{ flexGrow: 1 }}>
                        <TextEdit
                            editIconIsVisible={thisUserOwnsThisMetaAnalysis}
                            isLoading={updateMetaAnalysisNameIsLoading}
                            onSave={updateName}
                            sx={{ input: { fontSize: '1.5rem' } }}
                            label="name"
                            textToEdit={metaAnalysis?.name || ''}
                        >
                            <Box sx={MetaAnalysisPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        MetaAnalysisPageStyles.displayedText,
                                        !metaAnalysis?.name ? MetaAnalysisPageStyles.noData : {},
                                    ]}
                                    variant="h5"
                                >
                                    {metaAnalysis?.name || 'No name'}
                                </Typography>
                            </Box>
                        </TextEdit>

                        <TextEdit
                            editIconIsVisible={thisUserOwnsThisMetaAnalysis}
                            isLoading={updateMetaAnalysisDescriptionIsLoading}
                            onSave={updateDescription}
                            label="description"
                            sx={{ input: { fontSize: '1rem' } }}
                            textToEdit={metaAnalysis?.description || ''}
                        >
                            <Box sx={MetaAnalysisPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        MetaAnalysisPageStyles.displayedText,
                                        MetaAnalysisPageStyles.description,
                                        !metaAnalysis?.description
                                            ? MetaAnalysisPageStyles.noData
                                            : {},
                                    ]}
                                >
                                    {metaAnalysis?.description || 'No description'}
                                </Typography>
                            </Box>
                        </TextEdit>
                    </Box>
                    <Box>
                        <IconButton onClick={() => startTour()}>
                            <Help color="primary" />
                        </IconButton>
                    </Box>
                </Box>

                <Box data-tour="MetaAnalysisPage-1" sx={{ margin: '1rem 0' }}>
                    <NeurosynthAccordion
                        elevation={0}
                        accordionSummarySx={{
                            ':hover': { backgroundColor: 'primary.dark' },
                            backgroundColor: 'primary.main',
                            color: 'white',
                        }}
                        TitleElement={
                            <Typography variant="h6">View Meta-Analysis Specification</Typography>
                        }
                    >
                        <Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    marginTop: '1rem',
                                }}
                            >
                                <EditSpecificationDialog
                                    isOpen={editSpecificationDialogIsOpen}
                                    onCloseDialog={() => setEditSpecificationDialogIsOpen(false)}
                                />
                                <Button
                                    onClick={() => setEditSpecificationDialogIsOpen(true)}
                                    color="secondary"
                                    variant="contained"
                                    disableElevation
                                >
                                    Edit Specification
                                </Button>
                            </Box>

                            <Typography variant="h6">Details</Typography>

                            <MetaAnalysisSummaryRow
                                title="meta-analysis name"
                                value={metaAnalysisDisplayObj.name || ''}
                                caption={metaAnalysisDisplayObj.description || ''}
                            />
                        </Box>

                        <Box>
                            <Typography variant="h6">Data</Typography>

                            <MetaAnalysisSummaryRow
                                title="analysis type"
                                value={metaAnalysisDisplayObj.analysisType}
                                caption={metaAnalysisDisplayObj.analysisTypeDescription}
                            />

                            <MetaAnalysisSummaryRow
                                title="studyset id"
                                value={metaAnalysisDisplayObj.studyset}
                            />

                            {metaAnalysisDisplayObj.annotation && (
                                <MetaAnalysisSummaryRow
                                    title="annotation id"
                                    value={metaAnalysisDisplayObj?.annotation}
                                >
                                    <SelectAnalysesSummaryComponent
                                        annotationdId={metaAnalysisDisplayObj?.annotation || ''}
                                        studysetId={metaAnalysisDisplayObj.studyset}
                                        selectedValue={{
                                            selectionKey: metaAnalysisDisplayObj.inclusionColumn,
                                            type: metaAnalysisDisplayObj.inclusionColumnType,
                                        }}
                                    />
                                </MetaAnalysisSummaryRow>
                            )}

                            <MetaAnalysisSummaryRow
                                title="inclusion column"
                                value={metaAnalysisDisplayObj.inclusionColumn}
                            />
                        </Box>

                        <Box>
                            <Typography variant="h6">Algorithm</Typography>

                            <MetaAnalysisSummaryRow
                                title="algorithm and optional arguments"
                                value={metaAnalysisDisplayObj?.estimator}
                            >
                                <DynamicInputDisplay
                                    dynamicArg={metaAnalysisDisplayObj?.estimatorArgs}
                                />
                            </MetaAnalysisSummaryRow>

                            {metaAnalysisDisplayObj.corrector && (
                                <MetaAnalysisSummaryRow
                                    title="corrector and optional arguments"
                                    value={metaAnalysisDisplayObj?.corrector}
                                >
                                    <DynamicInputDisplay
                                        dynamicArg={metaAnalysisDisplayObj?.correctorArgs}
                                    />
                                </MetaAnalysisSummaryRow>
                            )}
                        </Box>
                    </NeurosynthAccordion>
                </Box>

                {!metaAnalysisResult && (
                    <Paper
                        sx={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            backgroundColor: 'info.light',
                        }}
                    >
                        <Box
                            sx={{
                                margin: '0rem 0 1rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <Box sx={{ marginRight: '1rem' }}>
                                <ErrorOutlineIcon sx={{ fontSize: '2rem', color: 'white' }} />
                            </Box>
                            <Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 'bold', color: 'white' }}
                                >
                                    Run your meta-analysis via one of the following methods.
                                </Typography>
                                <Typography sx={{ color: 'white' }}>
                                    Once neurosynth-compose has detected the status of your run, it
                                    will appear on this page.
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Box
                                sx={[
                                    MetaAnalysisPageStyles.runMethodContainer,
                                    { marginRight: '0.5rem' },
                                ]}
                                data-tour="MetaAnalysisPage-2"
                            >
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 'bold', marginBottom: '1rem' }}
                                >
                                    Online via google colab
                                </Typography>
                                <Typography sx={{ marginBottom: '0.5rem' }}>
                                    copy the meta-analysis id below and then click the button to
                                    open google collab
                                </Typography>
                                <Box>
                                    <CodeSnippet linesOfCode={[`${metaAnalysis?.id}`]} />
                                </Box>
                                <Box>
                                    <Button
                                        sx={{ marginTop: '1rem' }}
                                        variant="contained"
                                        component={Link}
                                        target="_blank"
                                        rel="noopener"
                                        href="https://githubtocolab.com/neurostuff/neurosynth-compose-notebook/blob/main/run_and_explore.ipynb"
                                    >
                                        open google collab
                                    </Button>
                                </Box>
                            </Box>
                            <Box
                                sx={[
                                    MetaAnalysisPageStyles.runMethodContainer,
                                    { marginLeft: '0.5rem' },
                                ]}
                                data-tour="MetaAnalysisPage-3"
                            >
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 'bold', marginBottom: '1rem' }}
                                >
                                    Locally via docker
                                </Typography>
                                <Typography>
                                    Click the "Help" button in the navigation panel at the top to
                                    learn more about this in the documentation
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                )}

                {metaAnalysisResult && <DisplayMetaAnalysisResult />}
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;
