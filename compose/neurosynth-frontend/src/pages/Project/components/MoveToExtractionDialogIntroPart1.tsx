import { Box, Button, Link, Typography } from '@mui/material';

const MoveToExtractionDialogIntroductionPart1: React.FC<{
    onNext: () => void;
}> = (props) => {
    return (
        <Box>
            <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                Congratulations on completing the Curation phase! You are now in{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href="https://neurostuff.github.io/compose-docs/guide/Project/Extraction"
                >
                    Extraction
                </Link>
                , where you'll finalize the data for your meta-analysis.
            </Typography>
            <Typography gutterBottom>Your main tasks in this step are:</Typography>
            <ul>
                <li>
                    <Typography>
                        <b>Add & Review Study Data</b>: Ensure every study has accurate activation coordinates. You will
                        need to either separate coordinates into distinct analyses for automatically processed studies,
                        or input coordinates from the original paper manually for new studies.
                    </Typography>
                </li>
                <li>
                    <Typography>
                        <b>Annotate Analyses</b>: Use annotations to tag the specific analyses (i.e., contrasts) you
                        want to include. This allows you to group analyses from different studies to generate distinct
                        meta-analyses later.
                    </Typography>
                </li>
            </ul>

            <Typography gutterBottom>
                Click <span style={{ fontWeight: 'bold', color: '#0077b6' }}>NEXT</span> to continue.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    sx={{ width: '220px', marginTop: '1rem' }}
                    onClick={props.onNext}
                    variant="contained"
                    disableElevation
                >
                    NEXT
                </Button>
            </Box>
        </Box>
    );
};

export default MoveToExtractionDialogIntroductionPart1;
