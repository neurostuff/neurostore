import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import ImportStudiesButton from 'pages/CurationImport/components/ImportStudiesButton';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';
import StartExtractionButton from './StartExtractionButton';

const CurationBoardAIInterfaceCuratorTableEmptyState: React.FC<{
    numIncluded: number;
    numUncategorized: number;
    numExcluded: number;
    columnIndex: number;
    isPrisma: boolean;
}> = ({ numIncluded, numUncategorized, numExcluded, columnIndex, isPrisma }) => {
    const noStudiesInCuration = numIncluded === 0 && numUncategorized === 0 && numExcluded === 0;
    const curationIsComplete = numIncluded > 0 && numUncategorized === 0;
    const { handleSelectPreviousGroup, handleSelectNextGroup } = useCurationBoardGroups();
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    if (noStudiesInCuration) {
        return (
            <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                <Card
                    sx={{
                        padding: '1rem',
                        width: {
                            xs: '200px',
                            lg: '300px',
                            xl: '400px',
                        },
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            To get started, <b>search</b> for studies to add to your project.
                        </Typography>
                        <Typography>
                            Take advantage of thousands of studies containing automatically extracted data.
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto' }}>
                        <Button
                            color="primary"
                            fullWidth
                            variant="contained"
                            disableElevation
                            onClick={() => {
                                navigate(`/projects/${projectId}/curation/search`);
                            }}
                        >
                            Search
                        </Button>
                    </CardActions>
                </Card>
                <Card
                    sx={{
                        padding: '1rem',
                        width: {
                            xs: '200px',
                            lg: '300px',
                            xl: '400px',
                        },
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            Or <b>import</b> studies via various methods, including Pubmed, Sleuth file, your reference
                            manager of choice, or by manually creating a new study.
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto' }}>
                        <Box sx={{ width: '100%' }}>
                            <ImportStudiesButton
                                fullWidth
                                size="medium"
                                sx={{}} // pass empty object to override
                            />
                        </Box>
                    </CardActions>
                </Card>
            </Box>
        );
    }

    if (isPrisma) {
        const prismaPhase = indexToPRISMAMapping(columnIndex);
        if (curationIsComplete) {
            return (
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            You've reviewed all the uncategorized studies in {prismaPhase}! Go to extraction to continue
                            your meta-analysis or add more studies
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                        <Button
                            sx={{ minWidth: '150px' }}
                            variant="contained"
                            color="primary"
                            disableElevation
                            onClick={() => {
                                navigate(`/projects/${projectId}/curation/search`);
                            }}
                        >
                            Search
                        </Button>
                        <ImportStudiesButton sx={{}} size="medium" />
                        <Box
                            sx={{
                                flexGrow: 1,
                                boxSizing: 'border-box',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <StartExtractionButton size="medium" />
                        </Box>
                    </CardActions>
                </Card>
            );
        } else {
            let text = '';
            let nextPhase = '';
            if (prismaPhase === 'identification') {
                text =
                    'No studies to review for identification. Add more studies, or continue on to the screening step';
                nextPhase = 'screening';
            } else if (prismaPhase === 'screening') {
                text =
                    'No studies to review for screening. Add more studies, promote duplicated studies from identification, or continue on to the eligibility step';
                nextPhase = 'eligibility';
            } else if (prismaPhase === 'eligibility') {
                text =
                    'No studies to review for eligibility. Add more studies, promote non excluded studies from screening, or continue on to the included step';
                nextPhase = 'included';
            } else {
                nextPhase = 'extraction';
                text =
                    'No included studies. Add more studies, or promote non excluded studies from eligibility to continue';
            }

            return (
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            {text}
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto' }}>
                        <Button
                            sx={{ minWidth: '150px' }}
                            variant="contained"
                            color="primary"
                            disableElevation
                            onClick={() => {
                                navigate(`/projects/${projectId}/curation/search`);
                            }}
                        >
                            Search
                        </Button>
                        <ImportStudiesButton sx={{}} size="medium" />
                        {prismaPhase !== undefined && (
                            <Box
                                sx={{
                                    flexGrow: 1,
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <Button
                                    disableElevation
                                    onClick={() => {
                                        handleSelectNextGroup();
                                    }}
                                >
                                    Go to {nextPhase}
                                </Button>
                            </Box>
                        )}
                    </CardActions>
                </Card>
            );
        }
    } else {
        if (curationIsComplete) {
            return (
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            You've reviewed all the uncategorized studies! Go to extraction to continue your
                            meta-analysis or add more studies
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                        <Button
                            sx={{ minWidth: '150px' }}
                            variant="contained"
                            color="primary"
                            disableElevation
                            onClick={() => {
                                navigate(`/projects/${projectId}/curation/search`);
                            }}
                        >
                            Search
                        </Button>
                        <ImportStudiesButton sx={{}} size="medium" />
                        <Box
                            sx={{
                                flexGrow: 1,
                                boxSizing: 'border-box',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <StartExtractionButton size="medium" />
                        </Box>
                    </CardActions>
                </Card>
            );
        } else {
            // included phase
            return (
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                            No included studies. Add more studies, or promote non excluded studies from{' '}
                            <b>Unreviewed</b> to continue
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto' }}>
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
                        <Box
                            sx={{
                                flexGrow: 1,
                                boxSizing: 'border-box',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <Button
                                disableElevation
                                onClick={() => {
                                    handleSelectPreviousGroup();
                                }}
                            >
                                Go to Unreviewed
                            </Button>
                        </Box>
                    </CardActions>
                </Card>
            );
        }
    }
};

export default CurationBoardAIInterfaceCuratorTableEmptyState;
