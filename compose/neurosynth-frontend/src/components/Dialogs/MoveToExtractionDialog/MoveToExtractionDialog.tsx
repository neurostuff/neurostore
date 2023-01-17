import { Box, TextField, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useCreateAnnotation, useCreateStudyset } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';

const MoveToExtractionDialog: React.FC<IDialog> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { data } = useGetProjectById(projectId);
    const { mutateAsync: createStudyset, isLoading: createStudysetIsLoading } = useCreateStudyset();
    const { mutateAsync: createAnnotation, isLoading: createAnnotationIsLoading } =
        useCreateAnnotation();
    const { mutateAsync: updateProject, isLoading: updateProjectIsLoading } = useUpdateProject();
    const { enqueueSnackbar } = useSnackbar();
    const history = useHistory();
    const [studysetDetails, setStudysetDetails] = useState({
        name: '',
        description: '',
    });

    const handleCloseDialog = () => {
        props.onCloseDialog();
    };

    const handleCreateStudyset = async () => {
        if (studysetDetails.name.length > 0 && projectId && data) {
            try {
                const newStudyset = await createStudyset({ ...studysetDetails });

                const newStudysetId = newStudyset.data.id;
                if (!newStudysetId)
                    throw new Error('expected a studyset id but did not receive one');

                const newAnnotation = await createAnnotation({
                    source: 'neurosynth',
                    sourceId: undefined,
                    annotation: {
                        name: `${studysetDetails.name} Annotation`,
                        description: `Annotation for studyset: ${studysetDetails.name}`,
                        note_keys: {},
                        studyset: newStudysetId,
                    },
                });

                const newAnnotationId = newAnnotation.data.id;
                if (!newAnnotationId)
                    throw new Error('expected an annotation id but did not receive one');

                await updateProject({
                    projectId: projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            extractionMetadata: {
                                studysetId: newStudysetId,
                                annotationId: newAnnotationId,
                                studyStatusList: [],
                            },
                        },
                    },
                });

                history.push(`/projects/${projectId}/extraction`);
            } catch (e) {
                enqueueSnackbar('there was an error creating a new studyset for this project', {
                    variant: 'error',
                });
            }
        }
    };

    return (
        <BaseDialog
            dialogTitle="Extraction Phase: Get Started"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={handleCloseDialog}
        >
            <Box>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    This is the start of the next phase: <b>extraction</b>.
                </Typography>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    <b>
                        You have completed your study curation, and the right most column of your
                        curation board is populated full of studies that you would like to include
                        in your meta-analysis
                    </b>
                </Typography>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    In the extraction step, you will create a studyset and add relevant data to the
                    studies in your studyset (such as coordinates and metadata). You will also add
                    analysis annotations that will be used to help filter analyses (or contrasts)
                    within your studies for the meta-analysis
                </Typography>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    In order to create the studyset, the studies included in the curation step need
                    to be ingested into the database. If neurosynth-compose already contains a study
                    that you are trying to ingest, you have the option of selecting that study
                    instead to add to your studyset.
                </Typography>
                <Typography gutterBottom sx={{ color: 'muted.main', marginBottom: '2rem' }}>
                    <b>
                        To get started, enter the new studyset name and description and then click
                        "CREATE STUDYSET"
                    </b>
                </Typography>
                <TextField
                    onChange={(event) =>
                        setStudysetDetails((prev) => ({ ...prev, name: event.target.value }))
                    }
                    sx={{ width: '100%', marginBottom: '1rem' }}
                    label="studyset name"
                />
                <TextField
                    onChange={(event) =>
                        setStudysetDetails((prev) => ({ ...prev, description: event.target.value }))
                    }
                    sx={{ width: '100%', marginBottom: '2rem' }}
                    multiline
                    rows={2}
                    label="studyset description"
                />

                <LoadingButton
                    sx={{ width: '160px' }}
                    disabled={studysetDetails.name.length === 0}
                    text="create studyset"
                    onClick={handleCreateStudyset}
                    loaderColor="secondary"
                    isLoading={createStudysetIsLoading || updateProjectIsLoading}
                    variant="contained"
                ></LoadingButton>
            </Box>
        </BaseDialog>
    );
};

export default MoveToExtractionDialog;
