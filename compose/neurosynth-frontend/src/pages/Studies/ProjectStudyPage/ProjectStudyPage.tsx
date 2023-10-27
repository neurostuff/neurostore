import { useAuth0 } from '@auth0/auth0-react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import FloatingStatusButtons from 'components/EditStudyComponents/FloatingStatusButtons/FloatingStatusButtons';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateStudy, useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationColumns,
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useUpdateStubField,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { setAnalysesInAnnotationAsIncluded } from 'pages/helpers/utils';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStoreIfRequired,
    useStudyAnalyses,
    useStudyAuthors,
    useStudyDOI,
    useStudyDescription,
    useGetStudyIsLoading,
    useStudyMetadata,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
    useStudyUser,
} from '../StudyStore';

const ProjectStudyPage: React.FC = (props) => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    useInitStudyStoreIfRequired();
    useInitProjectStoreIfRequired();

    const clearStudyStore = useClearStudyStore();
    const studyUser = useStudyUser();
    const getStudyIsLoading = useGetStudyIsLoading();
    const studyName = useStudyName();
    const studyDescription = useStudyDescription();
    const studyDOI = useStudyDOI();
    const studyPMID = useStudyPMID();
    const studyAuthors = useStudyAuthors();
    const studyPublication = useStudyPublication();
    const studyMetadata = useStudyMetadata();
    const studyAnalyses = useStudyAnalyses();
    const annotationId = useProjectExtractionAnnotationId();

    const { data: project } = useGetProjectById(projectId);
    const replaceStudyListStatusId = useProjectExtractionReplaceStudyListStatusId();
    const updateStubField = useUpdateStubField();

    const [allowEdits, setAllowEdits] = useState(false);
    const history = useHistory();
    const { isAuthenticated, user } = useAuth0();
    const curationColumns = useProjectCurationColumns();
    const { isLoading: createStudyIsLoading, mutateAsync: createStudy } = useCreateStudy();
    const {
        data: studyset,
        refetch,
        isRefetching,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId || undefined, true);
    const { mutateAsync: updateStudyset, isLoading: updateStudysetIsLoading } = useUpdateStudyset();

    const handleCloneStudy = async () => {
        if (studyset?.studies && project?.provenance?.extractionMetadata?.studysetId) {
            try {
                const allStudies = (studyset?.studies as StudyReturn[]).map((x) => x.id || '');
                const thisStudyIndex = allStudies.findIndex((x) => x === studyId);
                if (thisStudyIndex < 0) throw new Error('could not find study');

                const clonedStudy = await createStudy(studyId);
                if (!clonedStudy.data?.id)
                    throw new Error('did not find id for newly created study');

                allStudies[thisStudyIndex] = clonedStudy.data.id;

                await updateStudyset({
                    studysetId: project.provenance.extractionMetadata.studysetId,
                    studyset: {
                        studies: allStudies,
                    },
                });

                await setAnalysesInAnnotationAsIncluded(annotationId || '');

                await refetch();

                // we are cloning this study so the stub needs to refer to this study instead of the original
                const matchingStub = curationColumns[curationColumns.length - 1].stubStudies.find(
                    (x) => x.neurostoreId === studyId
                );
                if (matchingStub) {
                    updateStubField(
                        curationColumns.length - 1,
                        matchingStub.id,
                        'neurostoreId',
                        clonedStudy.data.id
                    );
                    replaceStudyListStatusId(studyId, clonedStudy.data.id);
                }

                clearStudyStore();

                history.push(
                    `/projects/${projectId}/extraction/studies/${clonedStudy.data.id}/edit`
                );
            } catch (e) {}
        }
    };

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/projects/${projectId}/extraction/studies/${studyId}/edit`);
    };

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!studyUser;
        const thisUserOwnsThisStudy = (studyUser || null) === (user?.sub || undefined);
        const allowEdit = isAuthenticated && userIDAndStudyIDExist && thisUserOwnsThisStudy;
        setAllowEdits(allowEdit);
    }, [isAuthenticated, user?.sub, studyUser, history]);

    const thisUserOwnsThisStudy = (studyUser || null) === (user?.sub || undefined);

    const showCloneMessage = !thisUserOwnsThisStudy;

    return (
        <StateHandlerComponent isLoading={getStudyIsLoading} isError={false}>
            <NeurosynthBreadcrumbs
                breadcrumbItems={[
                    {
                        text: 'Projects',
                        link: '/projects',
                        isCurrentPage: false,
                    },
                    {
                        text: project?.name || '',
                        link: `/projects/${projectId}`,
                        isCurrentPage: false,
                    },
                    {
                        text: 'Extraction',
                        link: `/projects/${projectId}/extraction`,
                        isCurrentPage: false,
                    },
                    {
                        text: studyName || '',
                        link: '',
                        isCurrentPage: true,
                    },
                ]}
            />
            {showCloneMessage && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        backgroundColor: 'info.light',
                        top: '1.5rem',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        margin: '1rem 0',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '50px' }}>
                            <ErrorOutlineIcon sx={{ fontSize: '2rem' }} />
                        </Box>
                        <Box>
                            <Typography variant="h6">
                                This study is owned by <b>neurosynth</b> and is <b>read-only</b>
                            </Typography>
                            <Typography>
                                If you would like to make your own edits, then you need to{' '}
                                <b>clone</b> the study.
                            </Typography>
                            <Typography>
                                Once you clone, your studyset will contain the new study instead of
                                the current one owned by <b>neurosynth</b>
                            </Typography>
                            <Typography>
                                You do not need to clone a study to update annotations.
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LoadingButton
                            text="Clone and Edit"
                            sx={{ width: '175px' }}
                            variant="contained"
                            isLoading={
                                createStudyIsLoading || updateStudysetIsLoading || isRefetching
                            }
                            color="secondary"
                            disableElevation
                            loaderColor="primary"
                            size="medium"
                            onClick={handleCloneStudy}
                        />
                    </Box>
                </Box>
            )}

            <FloatingStatusButtons studyId={studyId} />

            <DisplayStudy
                name={studyName}
                description={studyDescription}
                doi={studyDOI}
                pmid={studyPMID}
                authors={studyAuthors}
                publication={studyPublication}
                metadata={studyMetadata}
                analyses={studyAnalyses}
            />
        </StateHandlerComponent>
    );
};

export default ProjectStudyPage;
