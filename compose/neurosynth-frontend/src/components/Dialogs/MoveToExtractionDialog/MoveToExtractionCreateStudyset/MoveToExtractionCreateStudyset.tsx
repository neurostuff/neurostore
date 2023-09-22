import { Box, Link, TextField, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useCreateStudyset } from 'hooks';
import { useSnackbar } from 'notistack';
import {
    useProjectDescription,
    useProjectName,
    useUpdateExtractionMetadata,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const MoveToExtractionCreateStudyset: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const updateExtractionMetadata = useUpdateExtractionMetadata();
    const projectName = useProjectName();
    const projectDescription = useProjectDescription();
    const { mutateAsync: createStudyset, isLoading: createStudysetIsLoading } = useCreateStudyset();
    const { enqueueSnackbar } = useSnackbar();
    const [studysetDetails, setStudysetDetails] = useState({
        name: `Studyset for ${projectName}`,
        description: projectDescription,
    });

    const handleCreateStudyset = async () => {
        if (studysetDetails.name.length === 0 || !projectId) return;

        try {
            const newStudyset = await createStudyset({ ...studysetDetails });

            const newStudysetId = newStudyset.data.id;
            if (!newStudysetId) throw new Error('expected a studyset id but did not receive one');

            updateExtractionMetadata({
                studysetId: newStudysetId,
                studyStatusList: [],
            });

            props.onNavigate(ENavigationButton.NEXT);
        } catch (e) {
            enqueueSnackbar('there was an error creating a new studyset for this project', {
                variant: 'error',
            });
        }
    };

    return (
        <Box>
            <Typography gutterBottom>
                This is the start of the next phase:{' '}
                <Link
                    underline="hover"
                    sx={{ fontWeight: 'bold' }}
                    target="_blank"
                    href="https://neurostuff.github.io/compose-docs/guide/walkthrough/Project/Extraction"
                >
                    extraction
                </Link>
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
                    href="https://neurostuff.github.io/compose-docs/guide/glossary#analysis"
                >
                    analyses
                </Link>{' '}
                within your studies for your{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    href="https://neurostuff.github.io/compose-docs/"
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
                        href="https://neurostuff.github.io/compose-docs/guide/glossary#studyset"
                    >
                        studyset
                    </Link>{' '}
                    which will contain your studies, and then second{' '}
                    <Link
                        sx={{ fontWeight: 'normal' }}
                        underline="hover"
                        target="_blank"
                        href="https://neurostuff.github.io/compose-docs/guide/walkthrough/Project/Extraction#ingestion"
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
                value={studysetDetails.name}
                onChange={(event) =>
                    setStudysetDetails((prev) => ({ ...prev, name: event.target.value }))
                }
                sx={{ width: '100%', marginBottom: '1rem' }}
                label="studyset name"
            />
            <TextField
                value={studysetDetails.description}
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
                    isLoading={createStudysetIsLoading}
                    variant="contained"
                />
            </Box>
        </Box>
    );
};

export default MoveToExtractionCreateStudyset;
