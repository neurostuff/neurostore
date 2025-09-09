import { Box, Button, Typography } from '@mui/material';
import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';

const CurationBoardAIInterfaceIdentificationUI: React.FC<{
    hasUncategorizedStudies: boolean;
    onManuallyReview: () => void;
    onPromoteAllUncategorized: () => void;
}> = ({ hasUncategorizedStudies, onManuallyReview, onPromoteAllUncategorized }) => {
    const handleReviewDuplicates = () => {
        onManuallyReview();
    };

    if (hasUncategorizedStudies) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                }}
            >
                <Box sx={{ marginBottom: '2rem' }}>
                    <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                        Neurosynth-Compose reviewed your import and automatically excluded any duplicates found.
                    </Typography>
                    <Typography variant="body1" color="gray">
                        You can either manually review the duplicates or promote all uncategorized studies to screening.
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <Button variant="text" color="primary" onClick={handleReviewDuplicates} sx={{ minWidth: '200px' }}>
                        Manually review
                    </Button>

                    <CurationPromoteUncategorizedButton
                        variant="contained"
                        disableElevation
                        color="success"
                        onClick={onPromoteAllUncategorized}
                        sx={{ minWidth: '200px' }}
                        dialogTitle="Are you sure you want to promote all uncategorized studies to screening?"
                        dialogMessage="All studies that have not been marked as duplicates in this stage will be promoted"
                    >
                        Promote all uncategorized studies
                    </CurationPromoteUncategorizedButton>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
            }}
        >
            <Typography variant="h6" sx={{ marginBottom: '2rem', color: 'text.secondary' }}>
                There are no uncategorized studies left to review.
            </Typography>

            <Button variant="outlined" color="primary" onClick={handleReviewDuplicates} sx={{ minWidth: '150px' }}>
                Review all duplicates
            </Button>
        </Box>
    );
};

export default CurationBoardAIInterfaceIdentificationUI;
