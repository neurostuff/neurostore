import { Box, Button, Link, Typography } from '@mui/material';

const MoveToExtractionDialogIntroduction: React.FC<{
    onNext: () => void;
}> = (props) => {
    return (
        <Box>
            <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                This is the start of the next phase:{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/walkthrough/Project/Extraction"
                >
                    Extraction
                </Link>
            </Typography>
            <Typography gutterBottom>
                You finished Curation and selected the studies you want to include in your
                meta-analysis.
            </Typography>
            <Typography gutterBottom>
                Now, in Extraction, you will add or edit study data (like coordinates) and add
                annotations to identify target analyses (i.e. contrasts) to include in your
                meta-analysis.
            </Typography>
            <Typography>
                There are a few core concepts to familiarize yourself with during Extraction:
            </Typography>

            <Box sx={{ margin: '0.5rem 0' }}>
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/glossary#studyset"
                >
                    Studyset
                </Link>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    A studyset is a collection of studies you have selected
                </Typography>
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/glossary#analyses"
                >
                    Analyses
                </Link>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    Analyses are the statistical contrasts within a given study. Analyses contain
                    coordinates representing brain regions of interest
                </Typography>
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/glossary#annotations"
                >
                    Annotations
                </Link>
                <Typography gutterBottom sx={{ color: 'muted.main' }}>
                    Annotations are checkboxes indicating whether you want to include or exclude
                    analyses from your meta-analysis
                </Typography>

                <Typography>
                    To continue, click <b>NEXT</b>. Neurosynth Compose will proceed to create a new
                    studyset, create a new annotation, and ingest your selected studies into the new
                    studyset. If you have added any new studies, they will be created in NeuroStore
                    for you.
                </Typography>
                <Typography sx={{ fontWeight: 'bold' }}>
                    This process can take a few seconds or minutes depending on how many studies you
                    selected.
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    sx={{ width: '220px', marginTop: '1rem' }}
                    onClick={props.onNext}
                    variant="contained"
                >
                    NEXT
                </Button>
            </Box>
        </Box>
    );
};

export default MoveToExtractionDialogIntroduction;
