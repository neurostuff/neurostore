import { Typography, Button, Box, Link } from '@mui/material';

function MoveToExtractionDialogIntroPart2({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
    return (
        <Box>
            <Typography gutterBottom>
                Once you start, the system will automatically initialize your project by:
            </Typography>

            <ul>
                <li>
                    <Typography>Creating a new Studyset from your curated selections.</Typography>
                </li>
                <li>
                    <Typography>Ingesting your studies, which adds any new ones to the NeuroStore database.</Typography>
                </li>
                <li>
                    <Typography>
                        Creating a default Annotation column so you can begin selecting analyses. You can create
                        additional annotation columns later to form different groups.
                    </Typography>
                </li>
            </ul>

            <Typography gutterBottom>
                This one-time setup can take several seconds to a few minutes, depending on the number of studies you
                selected. You can review our full guide to{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/Project/Extraction"
                >
                    Extraction
                </Link>{' '}
                in our documentation.
            </Typography>

            <Typography gutterBottom>
                To get started, click <span style={{ fontWeight: 'bold', color: '#0077b6' }}>START</span> below.
            </Typography>

            {/* <Box sx={{ margin: '0.5rem 0' }}>
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
                    Analyses are the statistical contrasts within a given study. Analyses contain coordinates
                    representing brain regions of interest
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
                    Annotations are checkboxes indicating whether you want to include or exclude analyses from your
                    meta-analysis
                </Typography>

                <Typography>
                    To continue, click <b>NEXT</b>. Neurosynth Compose will proceed to create a new studyset, create a
                    new annotation, and ingest your selected studies into the new studyset. If you have added any new
                    studies, they will be created in NeuroStore for you.
                </Typography>
                <Typography sx={{ fontWeight: 'bold' }}>
                    This process can take a few seconds or minutes depending on how many studies you selected.
                </Typography>
            </Box> */}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <Button sx={{ width: '220px' }} onClick={onPrev} variant="outlined" disableElevation>
                    PREVIOUS
                </Button>
                <Button sx={{ width: '220px' }} onClick={onNext} variant="contained" disableElevation>
                    START
                </Button>
            </Box>
        </Box>
    );
}

export default MoveToExtractionDialogIntroPart2;
