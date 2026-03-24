import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';
import { useGetCurationSummary, useUserCanEdit } from 'hooks';
import { useProjectCurationDuplicates, useProjectCurationImports } from 'pages/Project/store/ProjectStore';
import CurationBoardAIInterfaceCuratorTableHints from './CurationBoardAIInterfaceCuratorTableHints';
import { ChevronRight } from '@mui/icons-material';
import StartExtractionButton from './StartExtractionButton';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';

const CurationBoardAIInterfaceIdentificationUI: React.FC<{
    hasUncategorizedStudies: boolean;
    hasIdentificationStudies: boolean;
    onManuallyReview: () => void;
}> = ({ hasUncategorizedStudies, onManuallyReview, hasIdentificationStudies }) => {
    const curationDuplicates = useProjectCurationDuplicates();
    const imports = useProjectCurationImports();
    const { user } = useAuth0();
    const canEdit = useUserCanEdit(user?.sub || undefined);
    const { included, uncategorized } = useGetCurationSummary();
    const curationIsComplete = included > 0 && uncategorized === 0;
    const { handleSelectNextGroup } = useCurationBoardGroups();

    const handleReviewDuplicates = () => {
        onManuallyReview();
    };

    if (hasIdentificationStudies) {
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
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        {hasUncategorizedStudies ? (
                            <Box>
                                {curationDuplicates.length > 0 ? (
                                    <Typography variant="h6" gutterBottom>
                                        We identified {curationDuplicates.length} duplicate{' '}
                                        {curationDuplicates.length > 1 ? 'studies' : 'study'} across your{' '}
                                        {imports.length > 1 ? `${imports.length} imports` : 'import'}.
                                    </Typography>
                                ) : (
                                    <Typography variant="h6" gutterBottom>
                                        We did not identify any duplicate studies within your{' '}
                                        {imports.length > 1 ? `${imports.length} imports` : 'import'}.
                                    </Typography>
                                )}
                                <Typography variant="h6">
                                    You can manually review for duplicates, add more studies, or promote all unique
                                    studies and begin Screening
                                </Typography>
                            </Box>
                        ) : (
                            <Box>
                                <Typography variant="h6">
                                    There are no more studies left to review. Add more studies or continue to{' '}
                                    {curationIsComplete ? 'extraction' : 'screening'}.
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                    <CardActions sx={{ display: 'flex' }}>
                        {hasIdentificationStudies && (
                            <Button variant="text" color="primary" onClick={handleReviewDuplicates}>
                                {hasUncategorizedStudies
                                    ? 'Manually review'
                                    : `Review all duplicates (${curationDuplicates.length})`}
                            </Button>
                        )}
                        {!hasUncategorizedStudies && (
                            <Button onClick={() => handleSelectNextGroup()} disableElevation>
                                Go to Screening <ChevronRight />
                            </Button>
                        )}
                        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {hasUncategorizedStudies ? (
                                <CurationPromoteUncategorizedButton
                                    onComplete={() => handleSelectNextGroup()}
                                    variant="contained"
                                    disableElevation
                                    color="success"
                                    dialogTitle="Are you sure you want to promote all uncategorized studies to screening?"
                                    dialogMessage="All studies that have not been marked as duplicates in this stage will be promoted"
                                    disabled={!canEdit}
                                >
                                    Promote all studies and screen
                                </CurationPromoteUncategorizedButton>
                            ) : curationIsComplete ? (
                                <StartExtractionButton size="medium" />
                            ) : null}
                        </Box>
                    </CardActions>
                </Card>
            </Box>
        );
    }

    return <CurationBoardAIInterfaceCuratorTableHints numVisibleStudies={0} columnIndex={0} />;
};

export default CurationBoardAIInterfaceIdentificationUI;
