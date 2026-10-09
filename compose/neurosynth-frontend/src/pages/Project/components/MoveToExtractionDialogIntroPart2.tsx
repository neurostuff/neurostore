import { AutoAwesomeMotion, CloudUpload, Label, ScatterPlot, ViewColumn } from '@mui/icons-material';
import { Alert, Box, Button, Link, Stack } from '@mui/material';
import GlossaryLink from 'components/GlossaryLink';
import MoveToExtractionDialogSection, {
    type MoveToExtractionDialogSectionItem,
} from 'pages/Project/components/MoveToExtractionDialogSection';

const TASKS: MoveToExtractionDialogSectionItem[] = [
    {
        icon: <ScatterPlot color="primary" />,
        title: 'Add & Review Study Data',
        description: (
            <>
                Ensure every study has accurate activation coordinates. You will need to either separate coordinates
                into distinct <GlossaryLink hash="analysis">analyses</GlossaryLink> for automatically processed studies,
                or input coordinates from the original paper manually for new studies.
            </>
        ),
    },
    {
        icon: <Label color="primary" />,
        title: 'Annotate Analyses',
        description: (
            <>
                Use <GlossaryLink hash="annotation">annotations</GlossaryLink> to tag the specific analyses (i.e.,
                contrasts) you want to include. This allows you to group analyses from different studies to generate
                distinct meta-analyses later.
            </>
        ),
    },
];

const SETUP_STEPS: MoveToExtractionDialogSectionItem[] = [
    {
        icon: <AutoAwesomeMotion color="primary" />,
        title: 'Create a studyset',
        description: (
            <>
                A new <GlossaryLink hash="studyset">studyset</GlossaryLink> is created from your curated selections.
            </>
        ),
    },
    {
        icon: <CloudUpload color="primary" />,
        title: (
            <>
                <GlossaryLink hash="ingestion">Ingest</GlossaryLink> your studies
            </>
        ),
        description: <>Any new studies are added to the NeuroStore database.</>,
    },
    {
        icon: <ViewColumn color="primary" />,
        title: 'Create a default "included" annotation column',
        description: (
            <>
                You can begin selecting analyses right away, and add more{' '}
                <GlossaryLink hash="annotations">annotation</GlossaryLink> columns later to form different groups.
            </>
        ),
    },
];

function MoveToExtractionDialogIntroPart2({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
    return (
        <Box>
            <Stack spacing={2}>
                <MoveToExtractionDialogSection title="Your main tasks in this step" items={TASKS} />
                <MoveToExtractionDialogSection
                    title="Once you start, the system will automatically:"
                    items={SETUP_STEPS}
                />
                <Alert severity="info">
                    This one-time setup can take several seconds to a few minutes, depending on the number of studies
                    you selected. You can review our full guide to{' '}
                    <Link
                        underline="hover"
                        target="_blank"
                        rel="noreferrer"
                        href="https://neurostuff.github.io/compose-docs/guide/Project/Extraction"
                    >
                        Extraction
                    </Link>{' '}
                    in our documentation.
                </Alert>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <Button sx={{ width: '220px' }} onClick={onPrev} disableElevation>
                    BACK
                </Button>
                <Button sx={{ width: '220px' }} onClick={onNext} variant="contained" disableElevation>
                    START
                </Button>
            </Box>
        </Box>
    );
}

export default MoveToExtractionDialogIntroPart2;
