import { Box, Link, TextField, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useCreateAnnotation, useCreateStudyset } from 'hooks';
import { useSnackbar } from 'notistack';
import { useUpdateExtractionMetadata } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const MoveToExtractionCreateStudyset: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const updateExtractionMetadata = useUpdateExtractionMetadata();
    const { mutateAsync: createStudyset, isLoading: createStudysetIsLoading } = useCreateStudyset();
    const { mutateAsync: createAnnotation, isLoading: createAnnotationIsLoading } =
        useCreateAnnotation();
    const { enqueueSnackbar } = useSnackbar();
    const [studysetDetails, setStudysetDetails] = useState({
        name: '',
        description: '',
    });

    const handleCreateStudyset = async () => {
        if (studysetDetails.name.length > 0 && projectId) {
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
                        note_keys: {
                            included: 'boolean', // default note key
                        },
                        studyset: newStudysetId,
                    },
                });

                const newAnnotationId = newAnnotation.data.id;
                if (!newAnnotationId)
                    throw new Error('expected an annotation id but did not receive one');

                updateExtractionMetadata({
                    studysetId: newStudysetId,
                    annotationId: newAnnotationId,
                    studyStatusList: [],
                });

                props.onNavigate(ENavigationButton.NEXT);
            } catch (e) {
                enqueueSnackbar('there was an error creating a new studyset for this project', {
                    variant: 'error',
                });
            }
        }
    };

    return (
        <Box>
            <Typography gutterBottom>
                This is the start of the next phase: <b>extraction</b>.
            </Typography>
            <Typography gutterBottom>
                At this point, you have completed your study curation, and the right most column of
                your curation board is populated full of studies of interest.
            </Typography>
            <Typography gutterBottom>
                In the extraction step, you will add relevant data to your studies such as
                coordinates and metadata. You will also add annotations that will be used to help
                filter{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    href="https://neurostuff.github.io/neurostore/"
                >
                    analyses
                </Link>{' '}
                within your studies for your{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    href="https://neurostuff.github.io/neurostore/"
                >
                    meta-analysis
                </Link>
                .
            </Typography>
            <Typography sx={{ color: 'secondary.main' }}>
                The studies you have included in the curation step do not yet exist in the
                neurostore database and need to be added.
            </Typography>
            <Typography gutterBottom>
                <b>
                    To start extracting, you first need to create a{' '}
                    <Link
                        sx={{ fontWeight: 'normal' }}
                        underline="hover"
                        target="_blank"
                        href="https://neurostuff.github.io/neurostore/"
                    >
                        studyset
                    </Link>{' '}
                    which will contain your studies, and then second{' '}
                    <Link
                        sx={{ fontWeight: 'normal' }}
                        underline="hover"
                        target="_blank"
                        href="https://neurostuff.github.io/neurostore/"
                    >
                        ingest
                    </Link>{' '}
                    the studies you curated from the previous step into neurostore.
                </b>
            </Typography>
            <Typography gutterBottom sx={{ marginBottom: '1rem' }}>
                To get started, enter your studyset name and description and then click "CREATE
                STUDYSET"
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <LoadingButton
                    sx={{ width: '160px' }}
                    disabled={studysetDetails.name.length === 0}
                    text="create studyset"
                    onClick={handleCreateStudyset}
                    loaderColor="secondary"
                    isLoading={createStudysetIsLoading || createAnnotationIsLoading}
                    variant="contained"
                />
            </Box>
        </Box>
    );
};

export default MoveToExtractionCreateStudyset;
