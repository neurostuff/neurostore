import { Box, Button, Chip, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetMetaAnalysisById } from 'hooks';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { ResultReturn, SpecificationReturn, StudysetReturn } from 'neurosynth-compose-typescript-sdk';
import EditSpecificationDialog from 'pages/MetaAnalysis/components/EditSpecificationDialog';
import MetaAnalysisPageStyles from 'pages/MetaAnalysis/MetaAnalysisPage.styles';
import { useInitProjectStoreIfRequired, useProjectName, useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { NeurostoreAnnotation } from 'utils/api';
import MetaAnalysisResult from './components/MetaAnalysisResult';
import DisplayMetaAnalysisSpecification from './components/MetaAnalysisSpecification';
import RunMetaAnalysisInstructions from './components/RunMetaAnalysisInstructions';
import MetaAnalysisResultStatusAlert from './components/MetaAnalysisResultStatusAlert';

const MetaAnalysisPage: React.FC = (props) => {
    // const { startTour } = useGetTour('MetaAnalysisPage');
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);

    useInitProjectStoreIfRequired();
    const projectName = useProjectName();

    /**
     * We need to use two separate instances of the same hook so that it only shows
     * the name loading when we update the name, and only the description loading when
     * we update the description
     */
    const { mutate: updateMetaAnalysisName, isLoading: updateMetaAnalysisNameIsLoading } = useUpdateMetaAnalysis();

    const { mutate: updateMetaAnalysisDescription, isLoading: updateMetaAnalysisDescriptionIsLoading } =
        useUpdateMetaAnalysis();

    const {
        data: metaAnalysis,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);
    const { data: metaAnalysisResult, isLoading: getMetaAnalysisResultIsLoading } = useGetMetaAnalysisResultById(
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

    const noMetaAnalysisResults = (metaAnalysis?.results || []).length === 0 && !metaAnalysisResult;

    return (
        <>
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading || getMetaAnalysisResultIsLoading}
                isError={getMetaAnalysisIsError}
                errorMessage="There was an error getting your meta-analysis"
            >
                {viewingThisPageFromProject && (
                    <Box sx={{ marginBottom: '0.5rem' }}>
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
                    <Box sx={{ width: '100%' }}>
                        {metaAnalysis?.username && (
                            <Chip
                                variant="filled"
                                size="small"
                                label={`Owner: ${metaAnalysis.username}`}
                                sx={{
                                    color: 'muted.main',
                                    marginBottom: '0.25rem',
                                }}
                            />
                        )}
                        <TextEdit
                            editIconIsVisible={editsAllowed}
                            isLoading={updateMetaAnalysisNameIsLoading}
                            onSave={updateName}
                            textFieldSx={{ input: { fontSize: '1.5rem' } }}
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
                            editIconIsVisible={editsAllowed}
                            isLoading={updateMetaAnalysisDescriptionIsLoading}
                            onSave={updateDescription}
                            label="description"
                            textFieldSx={{ input: { fontSize: '1rem' } }}
                            textToEdit={metaAnalysis?.description || ''}
                        >
                            <Box sx={MetaAnalysisPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        MetaAnalysisPageStyles.displayedText,
                                        MetaAnalysisPageStyles.description,
                                        !metaAnalysis?.description ? MetaAnalysisPageStyles.noData : {},
                                    ]}
                                >
                                    {metaAnalysis?.description || 'No description'}
                                </Typography>
                            </Box>
                        </TextEdit>
                    </Box>
                </Box>

                {noMetaAnalysisResults ? (
                    <>
                        <MetaAnalysisResultStatusAlert
                            metaAnalysis={metaAnalysis}
                            metaAnalysisResult={metaAnalysisResult}
                        />
                        <NeurosynthAccordion
                            elevation={0}
                            expandIconColor={editsAllowed ? 'secondary.main' : 'primary.main'}
                            sx={{
                                border: '2px solid',
                                borderColor: editsAllowed ? 'secondary.main' : 'primary.main',
                            }}
                            accordionSummarySx={{
                                ':hover': {
                                    backgroundColor: '#f2f2f2',
                                },
                            }}
                            TitleElement={
                                <Typography
                                    sx={{
                                        color: editsAllowed ? 'secondary.main' : 'primary.main',
                                    }}
                                >
                                    {editsAllowed ? 'View/Edit' : 'View'} Meta-Analysis Specification
                                </Typography>
                            }
                        >
                            <Box>
                                <EditSpecificationDialog
                                    isOpen={editSpecificationDialogIsOpen}
                                    onCloseDialog={() => setEditSpecificationDialogIsOpen(false)}
                                />
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditSpecificationDialogIsOpen(true);
                                    }}
                                    color="secondary"
                                    variant="contained"
                                    size="small"
                                    sx={{ marginBottom: '1rem' }}
                                    disableElevation
                                    disabled={!editsAllowed}
                                >
                                    Edit Specification
                                </Button>
                            </Box>
                            <DisplayMetaAnalysisSpecification
                                metaAnalysisId={metaAnalysis?.id || ''}
                                projectId={projectId || ''}
                            />
                        </NeurosynthAccordion>
                        <Box sx={{ marginTop: '1rem' }}>
                            <RunMetaAnalysisInstructions metaAnalysisId={metaAnalysis?.id || ''} />
                        </Box>
                    </>
                ) : (
                    <MetaAnalysisResult />
                )}
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;
