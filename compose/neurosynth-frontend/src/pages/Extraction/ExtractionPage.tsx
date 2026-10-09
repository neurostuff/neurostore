import { Box, Button, Typography } from '@mui/material';
import CopyableId from 'components/CopyableId/CopyableId';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetStudysetSummaryById, useUpdateStudyset } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import ExtractionAdvanceButton from 'pages/Extraction/components/ExtractionAdvanceButton';
import ExtractionOutOfSync from 'pages/Extraction/components/ExtractionOutOfSync';
import { hasDifferenceBetweenStudysetAndCuration } from 'pages/Extraction/ExtractionPage.helpers';
import {
    useGetProjectIsLoading,
    useProjectCurationColumns,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExtractionTable from './components/ExtractionTable';

const ExtractionPage = () => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();

    const projectName = useProjectName();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const columns = useProjectCurationColumns();
    const loading = useGetProjectIsLoading();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isRefetching: getStudysetIsRefetching,
        isError: getStudysetIsError,
    } = useGetStudysetSummaryById(studysetId);

    const { mutate } = useUpdateStudyset();

    const [fieldBeingUpdated, setFieldBeingUpdated] = useState('');
    const [showReconcilePrompt, setShowReconcilePrompt] = useState(false);

    useEffect(() => {
        if (!loading && !getStudysetIsLoading && columns.length > 0 && studyset?.studies) {
            const includedStudies = columns[columns.length - 1].stubStudies;
            const isDifferent = hasDifferenceBetweenStudysetAndCuration(includedStudies, studyset.studies);
            setShowReconcilePrompt(isDifferent);
        }
    }, [columns, getStudysetIsLoading, studyset?.studies, loading]);

    const handleUpdateStudyset = (updatedText: string, fieldName: string) => {
        if (studysetId) {
            setFieldBeingUpdated(fieldName);
            mutate(
                {
                    studysetId: studysetId,
                    studyset: {
                        [fieldName]: updatedText,
                    },
                },
                {
                    onSettled: () => {
                        setFieldBeingUpdated('');
                    },
                }
            );
        }
    };

    return (
        <StateHandlerComponent isError={getStudysetIsError} isLoading={getStudysetIsLoading}>
            <Box sx={{ minWidth: '450px', margin: '0 auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: projectName || '',
                                    link: `/projects/${projectId}`,
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Extraction',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <LoadingStateIndicatorProject isLoading={getStudysetIsRefetching} />
                    </Box>
                    <Box>
                        <Button
                            color="secondary"
                            variant="contained"
                            disableElevation
                            onClick={() => navigate(`/projects/${projectId}/extraction/annotations`)}
                        >
                            Annotations
                        </Button>
                        <ExtractionAdvanceButton sx={{ marginLeft: '1rem' }} />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                    <CopyableId label="Studyset ID" id={studysetId} />
                    <CopyableId label="Annotation ID" id={annotationId} />
                </Box>
                {showReconcilePrompt && (
                    <Box sx={{ my: 1 }}>
                        <ExtractionOutOfSync />
                    </Box>
                )}
                <Box sx={{ flexGrow: 1 }}>
                    <Box>
                        <TextEdit
                            editIconIsVisible={canEdit}
                            isLoading={fieldBeingUpdated === 'name'}
                            label="Studyset Name"
                            textFieldSx={{ input: { fontSize: '1.5rem' } }}
                            fieldName="name"
                            onSave={handleUpdateStudyset}
                            textToEdit={studyset?.name || ''}
                        >
                            <Typography variant="h5">
                                {studyset?.name || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No name
                                    </Box>
                                )}
                            </Typography>
                        </TextEdit>
                    </Box>
                    <Box>
                        <TextEdit
                            editIconIsVisible={canEdit}
                            isLoading={fieldBeingUpdated === 'description'}
                            multiline
                            fieldName="description"
                            label="Studyset Description"
                            textFieldSx={{ fontSize: '1rem' }}
                            onSave={handleUpdateStudyset}
                            textToEdit={studyset?.description || ''}
                        >
                            <Typography sx={{ color: 'muted.main', whiteSpace: 'pre-line' }} variant="body1">
                                {studyset?.description || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No description
                                    </Box>
                                )}
                            </Typography>
                        </TextEdit>
                    </Box>
                </Box>

                <Box sx={{ marginTop: '0.5rem' }}>
                    <ExtractionTable />
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default ExtractionPage;
