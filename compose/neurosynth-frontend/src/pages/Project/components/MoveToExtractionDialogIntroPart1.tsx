import { PlayArrow, SkipNext } from '@mui/icons-material';
import { Alert, Box, Button, Link, Stack } from '@mui/material';
import { EAnalysisType } from 'hooks/projects/Project.types';
import MoveToExtractionDialogSection from 'pages/Project/components/MoveToExtractionDialogSection';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';

const getOptions = (analysisType: EAnalysisType) => [
    {
        icon: <PlayArrow color="primary" />,
        title: 'Continue to Extraction',
        description:
            analysisType === EAnalysisType.IBMA
                ? 'Finalize the data for your image based meta-analysis by reviewing study images and annotating analyses.'
                : 'Finalize the data for your coordinate based meta-analysis by reviewing study coordinates and annotating analyses.',
    },
    {
        icon: <SkipNext color="secondary" />,
        title: 'Skip Extraction',
        description: 'Jump straight to specifying your meta-analysis.',
    },
];

const MoveToExtractionDialogIntroductionPart1 = (props: { onNext: () => void; onSkip: () => void }) => {
    const analysisType = useProjectAnalysisType() ?? EAnalysisType.CBMA;
    const options = getOptions(analysisType);

    return (
        <Box>
            <Stack spacing={2}>
                <Alert severity="success" sx={{ fontWeight: 'bold' }}>
                    Congratulations on completing the Curation phase! You are now in{' '}
                    <Link
                        underline="hover"
                        target="_blank"
                        rel="noreferrer"
                        href="https://neurostuff.github.io/compose-docs/guide/Project/Extraction"
                    >
                        Extraction
                    </Link>
                    , where you can finalize the data for your meta-analysis.
                </Alert>

                <MoveToExtractionDialogSection title="What would you like to do?" items={options} />
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button
                    sx={{ width: '220px', mr: 1 }}
                    onClick={props.onSkip}
                    disableElevation
                    color="secondary"
                    startIcon={<SkipNext />}
                >
                    Skip Extraction
                </Button>
                <Button
                    startIcon={<PlayArrow />}
                    sx={{ width: '220px' }}
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
