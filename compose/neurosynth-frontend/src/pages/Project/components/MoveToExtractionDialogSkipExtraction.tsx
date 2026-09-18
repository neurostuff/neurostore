import { Alert, Box, Button, Typography } from '@mui/material';
import GlossaryLink from 'components/GlossaryLink';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';

const getSkipExtractionMessage = (analysisType: EAnalysisType) => {
    const dataKind = analysisType === EAnalysisType.IBMA ? 'images' : 'coordinates';
    return `The extraction step allows you to confirm accurate ${dataKind}, separate ${dataKind} into distinct analyses and tag/group analyses via annotations.`;
};

function MoveToExtractionDialogSkipExtraction({
    onCancel,
    onConfirm,
}: {
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const analysisType = useProjectAnalysisType() ?? EAnalysisType.CBMA;

    return (
        <Box>
            <Alert severity="warning">
                <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                    Skip extraction?
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {getSkipExtractionMessage(analysisType)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    If you change your mind, you can always come back to this step later.
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Skipping extraction still requires <GlossaryLink hash="ingestion">Ingestion</GlossaryLink> to be run
                    in order to continue specifying your meta-analysis.
                </Typography>
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <Button sx={{ width: '220px' }} onClick={onCancel} disableElevation>
                    BACK
                </Button>
                <Button
                    sx={{ width: '220px' }}
                    onClick={onConfirm}
                    variant="contained"
                    color="secondary"
                    disableElevation
                >
                    Yes, skip Extraction
                </Button>
            </Box>
        </Box>
    );
}

export default MoveToExtractionDialogSkipExtraction;
