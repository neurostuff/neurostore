import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';
import { useAuth0 } from '@auth0/auth0-react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Button, Link, Paper, Typography } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { isMultiGroupAlgorithm } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent.helpers';
import SelectAnalysesSummaryComponent from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesSummaryComponent';
import EditSpecificationDialog from 'components/Dialogs/EditSpecificationDialog/EditSpecificationDialog';
import DisplayMetaAnalysisResult from 'components/DisplayMetaAnalysisResult/DisplayMetaAnalysisResult';
import { getType } from 'components/EditMetadata';
import {
    IDynamicValueType,
    IMetaAnalysisParamsSpecification,
} from 'components/MetaAnalysisConfigComponents';
import DynamicInputDisplay from 'components/MetaAnalysisConfigComponents/DynamicInputDisplay/DynamicInputDisplay';
import MetaAnalysisSummaryRow from 'components/MetaAnalysisConfigComponents/MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetMetaAnalysisById } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';
import {
    Annotation,
    ResultReturn,
    Specification,
    SpecificationReturn,
    Studyset,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import {
    useInitProjectStoreIfRequired,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NeurostoreAnnotation } from 'utils/api';
import MetaAnalysisPageStyles from './MetaAnalysisPage.styles';

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

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

const getEstimatorDescription = (type: string | undefined, estimator: string | undefined) => {
    if (!estimator || !type) return '';
    return metaAnalysisSpecification?.[type as 'CBMA' | 'IBMA']?.[estimator].summary || '';
};

const MetaAnalysisPage: React.FC = (props) => {
    // const { startTour } = useGetTour('MetaAnalysisPage');
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const { user } = useAuth0();

    useInitProjectStoreIfRequired();
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

    const selectionText = useMemo(() => {
        if (!specification || !specification.filter || !specification.conditions) return '';
        const selectionKey = specification.filter;
        const selectionValue = specification.conditions[0]
            ? `: ${specification.conditions[0]}`
            : '';
        return `${selectionKey} ${selectionValue}`;
    }, [specification]);

    const referenceDataset = useMemo(() => {
        const isMulti = isMultiGroupAlgorithm({
            label: specification?.estimator?.type || '',
            description: '',
        });

        if (isMulti) {
            return specification?.conditions?.[1] !== undefined
                ? specification.conditions[1].toString()
                : specification?.database_studyset;
        } else {
            return null;
        }
    }, [
        specification?.conditions,
        specification?.database_studyset,
        specification?.estimator?.type,
    ]);

    const metaAnalysisTypeDescription = useMemo(() => {
        return getAnalysisTypeDescription((metaAnalysis?.specification as Specification)?.type);
    }, [metaAnalysis?.specification]);

    const metaAnalysisSpecification = metaAnalysis?.specification as Specification | undefined;
    const metaAnalysisAnnotation = metaAnalysis?.annotation as Annotation | undefined;
    const metaAnalysisStudyset = metaAnalysis?.studyset as Studyset | undefined;

    const canEditSpecification = (metaAnalysis?.results || []).length === 0;

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
                        {metaAnalysis?.username && (
                            <Typography sx={{ color: 'muted.main' }}>
                                Analysis Owner: {metaAnalysis.username}
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Box data-tour="MetaAnalysisPage-1" sx={{ margin: '1rem 0' }}>
                    <NeurosynthAccordion
                        elevation={0}
                        expandIconColor={canEditSpecification ? 'secondary.main' : 'primary.main'}
                        sx={{
                            border: '2px solid',
                            borderColor: canEditSpecification ? 'secondary.main' : 'primary.main',
                        }}
                        accordionSummarySx={{
                            ':hover': {
                                backgroundColor: '#f2f2f2',
                            },
                        }}
                        TitleElement={
                            <Typography
                                sx={{
                                    color: canEditSpecification ? 'secondary.main' : 'primary.main',
                                }}
                            >
                                {canEditSpecification ? 'View or Edit' : 'View'} Meta-Analysis
                                Specification
                            </Typography>
                        }
                    >
                        <Box>
                            {canEditSpecification && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        marginTop: '0.5rem',
                                    }}
                                >
                                    <EditSpecificationDialog
                                        isOpen={editSpecificationDialogIsOpen}
                                        onCloseDialog={() =>
                                            setEditSpecificationDialogIsOpen(false)
                                        }
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
                            )}
                        </Box>

                        <Box>
                            <Typography sx={{ fontWeight: 'bold' }}>Data</Typography>

                            <MetaAnalysisSummaryRow
                                title="analysis type"
                                value={metaAnalysisSpecification?.type || ''}
                                caption={metaAnalysisTypeDescription}
                            />

                            <MetaAnalysisSummaryRow
                                title="studyset id"
                                value={
                                    <Link
                                        target="_blank"
                                        href={`/studysets/${
                                            metaAnalysisStudyset?.neurostore_id || ''
                                        }`}
                                    >
                                        {metaAnalysisStudyset?.neurostore_id || ''}
                                    </Link>
                                }
                            />

                            <MetaAnalysisSummaryRow title="selection" value={selectionText}>
                                {referenceDataset && (
                                    <>
                                        <SelectAnalysesSummaryComponent
                                            annotationdId={
                                                metaAnalysisAnnotation?.neurostore_id || ''
                                            }
                                            studysetId={metaAnalysisStudyset?.neurostore_id || ''}
                                            selectedValue={{
                                                selectionKey: specification?.filter || '',
                                                type: getType(specification?.filter || ''),
                                                selectionValue: specification?.conditions?.[0],
                                            }}
                                        />
                                        <Typography sx={{ marginTop: '1rem', color: 'gray' }}>
                                            Reference Dataset: {referenceDataset}
                                        </Typography>
                                    </>
                                )}
                            </MetaAnalysisSummaryRow>
                        </Box>

                        <Box>
                            <Typography sx={{ fontWeight: 'bold' }}>Algorithm</Typography>

                            <MetaAnalysisSummaryRow
                                title="algorithm and optional arguments"
                                value={specification?.estimator?.type || ''}
                                caption={getEstimatorDescription(
                                    metaAnalysisSpecification?.type,
                                    specification?.estimator?.type
                                )}
                            >
                                <DynamicInputDisplay
                                    dynamicArg={
                                        (specification?.estimator?.args || {}) as IDynamicValueType
                                    }
                                />
                            </MetaAnalysisSummaryRow>

                            {specification?.corrector?.type && (
                                <MetaAnalysisSummaryRow
                                    title="corrector and optional arguments"
                                    value={specification?.corrector?.type || ''}
                                >
                                    <DynamicInputDisplay
                                        dynamicArg={
                                            (specification?.corrector?.args ||
                                                {}) as IDynamicValueType
                                        }
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
                                <Typography sx={{ marginBottom: '0.5rem' }}>
                                    copy the docker command below to run this meta-analysis locally
                                </Typography>
                                <Box>
                                    <CodeSnippet
                                        linesOfCode={[
                                            `docker run ghcr.io/neurostuff/nsc-runner:latest ${metaAnalysis?.id}`,
                                        ]}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                )}

                {metaAnalysisResult && (
                    <DisplayMetaAnalysisResult
                        metaAnalysis={metaAnalysis}
                        metaAnalysisResult={metaAnalysisResult}
                    />
                )}
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;
