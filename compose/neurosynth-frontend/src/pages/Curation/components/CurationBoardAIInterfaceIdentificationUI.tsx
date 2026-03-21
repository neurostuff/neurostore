import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Card, CardActions, CardContent, Link as MuiLink, Typography } from '@mui/material';
import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';
import { useGetCurationSummary, useUserCanEdit } from 'hooks';
import {
    useProjectCurationColumns,
    useProjectCurationDuplicates,
    useProjectCurationImports,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';
import ImportStudiesButton from 'pages/CurationImport/components/ImportStudiesButton';
import StartExtractionButton from './StartExtractionButton';

const CurationBoardAIInterfaceIdentificationUI: React.FC<{
    hasUncategorizedStudies: boolean;
    onManuallyReview: () => void;
    onPromoteAllUncategorized: () => void;
}> = ({ hasUncategorizedStudies, onManuallyReview, onPromoteAllUncategorized }) => {
    const cols = useProjectCurationColumns();
    const curationDuplicates = useProjectCurationDuplicates();
    const { groups, selectedGroup, handleSetSelectedGroup } = useCurationBoardGroups();
    const noStudies = useMemo(() => {
        return cols.every((col) => col.stubStudies.length === 0);
    }, [cols]);
    const imports = useProjectCurationImports();
    const { user } = useAuth0();
    const canEdit = useUserCanEdit(user?.sub || undefined);
    const navigate = useNavigate();
    const projectId = useProjectId();
    const { included, uncategorized } = useGetCurationSummary();

    const handleReviewDuplicates = () => {
        onManuallyReview();
    };

    const handleGoToScreening = () => {
        if (!selectedGroup) return;
        const nextColIndex = cols.findIndex((col) => col.id === selectedGroup.id) + 1;
        if (nextColIndex < 0) return;
        const nextCol = cols[nextColIndex];
        if (!nextCol) return;
        const nextGroup = groups.find((group) => group.id === nextCol.id);
        if (!nextGroup) return;
        handleSetSelectedGroup(nextGroup);
    };

    const curationIsComplete = included > 0 && uncategorized === 0;

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
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                            No studies in this project yet.{' '}
                            <MuiLink underline="hover" component={Link} to="import">
                                {' '}
                                Import studies
                            </MuiLink>{' '}
                            to get started.
                        </Typography>
                    </CardContent>
                </Card>
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
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Box sx={{ marginBottom: '1rem' }}>
                            {curationDuplicates.length > 0 ? (
                                <Typography variant="h6" gutterBottom>
                                    We automatically identified {curationDuplicates.length} duplicate{' '}
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
                                You can review imports manually to check for additional duplicates, promote all unique
                                uncategorized studies to the Screening step, or add more studies to expand your project.
                            </Typography>
                        </Box>
                    </CardContent>
                    <CardActions sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Button variant="text" color="primary" onClick={handleReviewDuplicates}>
                            Manually review
                        </Button>

                        <Button
                            color="primary"
                            variant="contained"
                            disableElevation
                            sx={{ minWidth: '150px' }}
                            onClick={() => {
                                navigate(`/projects/${projectId}/curation/search`);
                            }}
                        >
                            Search
                        </Button>
                        <ImportStudiesButton sx={{}} size="medium" />
                        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <CurationPromoteUncategorizedButton
                                variant="contained"
                                disableElevation
                                color="success"
                                onClick={onPromoteAllUncategorized}
                                // sx={{ minWidth: '200px' }}
                                dialogTitle="Are you sure you want to promote all uncategorized studies to screening?"
                                dialogMessage="All studies that have not been marked as duplicates in this stage will be promoted"
                                disabled={!canEdit}
                            >
                                Promote all uncategorized studies
                            </CurationPromoteUncategorizedButton>
                        </Box>
                    </CardActions>
                </Card>
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
            <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                <CardContent>
                    <Typography variant="h6">
                        There are no uncategorized studies left to review. Add more studies or continue to{' '}
                        {curationIsComplete ? 'extraction' : 'screening'}.
                    </Typography>
                </CardContent>
                <CardActions
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', lg: 'row' },
                        justifyContent: 'space-between',
                    }}
                >
                    <Button color="primary" onClick={handleReviewDuplicates} sx={{ minWidth: '150px' }}>
                        {curationDuplicates.length > 0 ? 'Review all duplicates' : 'Manually review (empty)'}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        disableElevation
                        sx={{ minWidth: '150px' }}
                        onClick={() => {
                            navigate(`/projects/${projectId}/curation/search`);
                        }}
                    >
                        Search
                    </Button>
                    <ImportStudiesButton sx={{}} size="medium" />
                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        {curationIsComplete ? (
                            <StartExtractionButton size="medium" />
                        ) : (
                            <Button disableElevation onClick={handleGoToScreening}>
                                Go to Screening
                            </Button>
                        )}
                    </Box>
                </CardActions>
            </Card>
        </Box>
    );
};

export default CurationBoardAIInterfaceIdentificationUI;
