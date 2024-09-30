import { Box, Button, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { StudyReturn } from 'neurostore-typescript-sdk';
import ExtractionOutOfSync from 'pages/Extraction/components/ExtractionOutOfSync';
import { resolveStudysetAndCurationDifferences } from 'pages/Extraction/Extraction.helpers';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectCurationColumns,
    useProjectExtractionStudysetId,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExtractionTable from './components/ExtractionTable';

export enum EExtractionStatus {
    'COMPLETED' = 'completed',
    'SAVEDFORLATER' = 'savedforlater',
    'UNCATEGORIZED' = 'uncategorized',
}

const ExtractionPage: React.FC = (props) => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();

    useInitProjectStoreIfRequired();

    const projectName = useProjectName();
    const studysetId = useProjectExtractionStudysetId();
    const columns = useProjectCurationColumns();
    const loading = useGetProjectIsLoading();
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isRefetching: getStudysetIsRefetching,
        isError: getStudysetIsError,
    } = useGetStudysetById(studysetId, true);
    const { mutate } = useUpdateStudyset();

    const [fieldBeingUpdated, setFieldBeingUpdated] = useState('');
    const [showReconcilePrompt, setShowReconcilePrompt] = useState(false);

    useEffect(() => {
        if (!loading && !getStudysetIsLoading && columns.length > 0 && studyset?.studies) {
            const includedStudies = columns[columns.length - 1].stubStudies;
            const isDifferent = resolveStudysetAndCurationDifferences(
                includedStudies,
                studyset.studies as StudyReturn[]
            );
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

    const handleMoveToSpecificationPhase = () => {
        if (canEditMetaAnalyses) {
            navigate(`/projects/${projectId}/meta-analyses`);
        } else {
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        scrollToMetaAnalysisProceed: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const isReadyToMoveToNextStep = useMemo(
        () =>
            extractionSummary.total === extractionSummary.completed && extractionSummary.total > 0,
        [extractionSummary]
    );

    return (
        <StateHandlerComponent isError={getStudysetIsError} isLoading={getStudysetIsLoading}>
            <Box sx={{ minWidth: '450px', margin: '0 auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
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
                        <ProjectIsLoadingText isLoading={getStudysetIsRefetching} />
                    </Box>
                    <Box>
                        <Button
                            sx={{ width: '220px' }}
                            color="secondary"
                            variant="contained"
                            disableElevation
                            onClick={() =>
                                navigate(`/projects/${projectId}/extraction/annotations`)
                            }
                        >
                            View Annotations
                        </Button>
                        {isReadyToMoveToNextStep && (
                            <Button
                                sx={{ marginLeft: '1rem' }}
                                onClick={handleMoveToSpecificationPhase}
                                color="success"
                                variant="contained"
                                disableElevation
                                disabled={!canEdit}
                            >
                                Move to Specification Phase
                            </Button>
                        )}
                    </Box>
                </Box>
                {showReconcilePrompt && <ExtractionOutOfSync />}
                <Box>
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
                            <Typography
                                sx={{ color: 'muted.main', whiteSpace: 'pre-line' }}
                                variant="body1"
                            >
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
