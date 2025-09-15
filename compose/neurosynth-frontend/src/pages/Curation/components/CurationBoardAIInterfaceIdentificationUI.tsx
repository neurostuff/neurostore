import { Box, Button, Link as MuiLink, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';
import { useProjectCurationColumns } from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';

const CurationBoardAIInterfaceIdentificationUI: React.FC<{
    hasUncategorizedStudies: boolean;
    onManuallyReview: () => void;
    onPromoteAllUncategorized: () => void;
}> = ({ hasUncategorizedStudies, onManuallyReview, onPromoteAllUncategorized }) => {
    const cols = useProjectCurationColumns();
    const noStudies = useMemo(() => {
        return cols.every((col) => col.stubStudies.length === 0);
    }, [cols]);

    const handleReviewDuplicates = () => {
        onManuallyReview();
    };

    if (noStudies) {
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
                    No studies in this project yet.{' '}
                    <MuiLink underline="hover" component={Link} to="import">
                        {' '}
                        Import studies
                    </MuiLink>{' '}
                    to get started.
                </Typography>
            </Box>
        );
    }

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
                        You can either manually review the import for duplicates or promote all uncategorized studies to
                        screening.
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
