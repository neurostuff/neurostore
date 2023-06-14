import { useAuth0 } from '@auth0/auth0-react';
import EditIcon from '@mui/icons-material/Edit';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Button, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import EditStudyAnnotations from 'components/EditAnnotations/EditStudyAnnotations';
import EditAnalysesStyles from 'components/EditStudyComponents/EditAnalyses/EditAnalyses.styles';
import FloatingStatusButtons from 'components/EditStudyComponents/FloatingStatusButtons/FloatingStatusButtons';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateStudy, useGetStudyById, useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useInitProjectStoreIfRequired,
    useProjectCurationColumns,
    useUpdateStubField,
} from 'pages/Projects/ProjectPage/ProjectStore';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useClearStudyStore, useInitStudyStore, useInitStudyStoreIfRequired } from '../StudyStore';

const ProjectStudyPage: React.FC = (props) => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    useInitStudyStoreIfRequired();
    useInitProjectStoreIfRequired();

    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();

    const [allowEdits, setAllowEdits] = useState(false);
    const history = useHistory();
    const { isAuthenticated, user } = useAuth0();
    const { data: project } = useGetProjectById(projectId);
    const updateStubField = useUpdateStubField();
    const curationColumns = useProjectCurationColumns();
    const { isLoading: createStudyIsLoading, mutateAsync: createStudy } = useCreateStudy();
    const {
        isLoading: getStudyIsLoading,
        isError: getStudyIsError,
        isFetching: getStudyIsFetching,
        isRefetching: getStudyIsRefetching,
        data,
    } = useGetStudyById(studyId);
    const { data: studyset } = useGetStudysetById(
        project?.provenance?.extractionMetadata?.studysetId || undefined
    );
    const { mutateAsync: updateStudyset, isLoading: updateStudysetIsLoading } = useUpdateStudyset();

    const handleCloneStudy = async () => {
        if (studyset?.studies && project?.provenance?.extractionMetadata?.studysetId) {
            try {
                const clonedStudy = await createStudy(studyId, {
                    onSuccess: (res) => {
                        const createdStudyId = res.data.id as string;
                        history.push(`/studies/${createdStudyId}`);
                    },
                });

                if (!clonedStudy.data?.id)
                    throw new Error('did not find id for newly created study');

                const allStudies = (studyset?.studies as StudyReturn[]).map((x) => x.id || '');
                const thisStudyIndex = allStudies.findIndex((x) => x === data?.id || '');
                if (thisStudyIndex < 0) throw new Error('could not find study');

                allStudies[thisStudyIndex] = clonedStudy.data.id;

                await updateStudyset({
                    studysetId: project.provenance.extractionMetadata.studysetId,
                    studyset: {
                        studies: allStudies,
                    },
                });

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
                }

                clearStudyStore();
                initStudyStore();

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
        const userIDAndStudyIDExist = !!user?.sub && !!data?.user;
        const thisUserOwnsThisStudy = (data?.user || null) === (user?.sub || undefined);
        const allowEdit = isAuthenticated && userIDAndStudyIDExist && thisUserOwnsThisStudy;
        setAllowEdits(allowEdit);
    }, [isAuthenticated, user?.sub, data?.user, history]);

    const thisUserOwnsThisStudy = (data?.user || null) === (user?.sub || undefined);

    const isViewingStudyFromProject = projectId !== undefined;
    const showCloneMessage = isViewingStudyFromProject && !thisUserOwnsThisStudy;

    return (
        <StateHandlerComponent
            isLoading={getStudyIsLoading || getStudyIsFetching || getStudyIsRefetching}
            isError={getStudyIsError}
        >
            {showCloneMessage && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        backgroundColor: 'info.light',
                        position: 'sticky',
                        top: '1.5rem',
                        color: 'white',
                        padding: '1rem',
                        zIndex: 999,
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        margin: '1rem',
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
                            isLoading={createStudyIsLoading || updateStudysetIsLoading}
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
            {isViewingStudyFromProject && (
                <Box sx={{ padding: '0 1rem' }} data-tour="StudyPage-8">
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            marginBottom: '0.5rem',
                        }}
                    >
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
                                    text: data?.name || '',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <Button
                            onClick={handleEditStudy}
                            endIcon={<EditIcon />}
                            disabled={!allowEdits}
                            size="small"
                            sx={{ width: '190px', marginLeft: '10px' }}
                            variant="contained"
                            disableElevation
                            color="secondary"
                        >
                            Edit Study
                        </Button>
                    </Box>
                    <Box sx={{ margin: '1rem 0' }}>
                        <NeurosynthAccordion
                            elevation={0}
                            expandIconColor={'secondary.main'}
                            sx={{
                                border: '1px solid',
                                borderColor: 'secondary.main',
                            }}
                            TitleElement={
                                <Typography sx={{ color: 'secondary.main' }}>
                                    Study Annotations
                                </Typography>
                            }
                        >
                            <EditStudyAnnotations />
                        </NeurosynthAccordion>
                    </Box>
                </Box>
            )}

            <DisplayStudy {...data} />
        </StateHandlerComponent>
    );
};

export default ProjectStudyPage;
