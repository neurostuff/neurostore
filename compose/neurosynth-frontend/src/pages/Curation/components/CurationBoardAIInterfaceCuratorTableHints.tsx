import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Box, Button, Card, CardActions, CardContent, Link, Typography } from '@mui/material';
import { useGetCurationSummary } from 'hooks';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import ImportStudiesButton from 'pages/CurationImport/components/ImportStudiesButton';
import {
    useProjectCurationColumn,
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
} from 'pages/Project/store/ProjectStore';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';
import StartExtractionButton from './StartExtractionButton';
import { useMemo } from 'react';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { Table } from '@tanstack/react-table';

const CurationBoardAIInterfaceCuratorTableHints: React.FC<{
    table?: Table<ICurationTableStudy> | undefined;
    columnIndex: number;
    numVisibleStudies: number;
}> = ({ table, columnIndex, numVisibleStudies }) => {
    const isPrisma = useProjectCurationIsPrisma();
    const { included, uncategorized, excluded } = useGetCurationSummary();
    const noStudiesInCuration = included === 0 && uncategorized === 0 && excluded === 0;
    const curationIsComplete = included > 0 && uncategorized === 0;
    const { handleSelectPreviousGroup, handleSelectNextGroup, selectedGroup } = useCurationBoardGroups();
    const columns = useProjectCurationColumns();
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const curationColumn = useProjectCurationColumn(columnIndex);
    const hasStudiesInSelectedPhase = curationColumn.stubStudies.length > 0;
    const hasVisibleStudies = numVisibleStudies > 0;

    const hasUncategorizedStudiesInSelectedPhase = useMemo(() => {
        return curationColumn.stubStudies.some((x) => x.exclusionTag === null);
    }, [curationColumn.stubStudies]);

    const handleClearFilters = () => {
        if (!table) return;
        table?.setColumnFilters([]);
        table?.setSorting([]);
    };

    // User has not started curation yet
    if (noStudiesInCuration) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    height: 'calc(100% - 53px)',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    boxSizing: 'border-box',
                }}
            >
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
                                Or <b>import</b> studies via various methods, including Pubmed, Sleuth file, your
                                reference manager of choice, or by manually creating a new study.
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
            </Box>
        );
    }

    if (hasVisibleStudies) return null;

    // no visible studies but there are studies in the selected phase: some table filters are applied but no studies match
    if (hasUncategorizedStudiesInSelectedPhase) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} p={1}>
                <Typography sx={{ color: 'warning.dark' }}>No studies match your current filters.</Typography>
                <Link sx={{ cursor: 'pointer' }} onClick={handleClearFilters} underline="hover" color="primary">
                    Clear filters
                </Link>
            </Box>
        );
    }

    // for prisma workflow
    if (isPrisma) {
        const prismaPhase = indexToPRISMAMapping(columnIndex);
        let text = '';
        let nextPhase = '';
        let previousPhase = '';
        if (prismaPhase === 'identification') {
            nextPhase = 'screening';
            text = 'No studies to review for identification. Add more studies, or continue on to the screening step';
        } else if (prismaPhase === 'screening') {
            nextPhase = 'eligibility';
            previousPhase = 'identification';
            text =
                'No studies to review for screening. Add more studies, promote non excluded studies from identification, or continue on to eligibility';
        } else if (prismaPhase === 'eligibility') {
            nextPhase = 'included';
            previousPhase = 'screening';
            text =
                'No studies to review for eligibility. Add more studies, promote non excluded studies from screening, or continue on to the included step';
        } else {
            nextPhase = 'extraction';
            previousPhase = 'eligibility';
            text =
                'No included studies. Add more studies, or promote non excluded studies from eligibility to continue';
        }

        if (curationIsComplete) {
            text = `You've reviewed all the uncategorized studies in ${prismaPhase}! Add more studies, or go to extraction to continue your meta-analysis.`;
        }

        return (
            <Box
                sx={{
                    display: 'flex',
                    height: 'calc(100% - 53px)',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    boxSizing: 'border-box',
                }}
            >
                <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                    <CardContent>
                        <Typography variant="h6">{text}</Typography>
                    </CardContent>
                    <CardActions sx={{ marginTop: 'auto', display: 'flex' }}>
                        {prismaPhase !== 'identification' && (
                            <Button
                                disableElevation
                                onClick={() => {
                                    handleSelectPreviousGroup();
                                }}
                            >
                                <ChevronLeft />
                                Back to {previousPhase}
                            </Button>
                        )}
                        {prismaPhase !== undefined && (
                            <Button
                                disableElevation
                                onClick={() => {
                                    handleSelectNextGroup();
                                }}
                            >
                                Go to {nextPhase}
                                <ChevronRight />
                            </Button>
                        )}
                        {curationIsComplete && (
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
                        )}
                    </CardActions>
                </Card>
            </Box>
        );
    }

    let nonPRISMAText = '';
    if (curationIsComplete) {
        nonPRISMAText = `You've reviewed all the uncategorized studies! Go to extraction to continue your meta-analysis or add more studies`;
    } else {
        nonPRISMAText = `No included studies. Add more studies, or promote non excluded studies from Unreviewed to continue`;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                height: 'calc(100% - 53px)',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                boxSizing: 'border-box',
            }}
        >
            <Card sx={{ padding: '1rem', width: { xs: '90%', lg: '70%' } }}>
                <CardContent>
                    <Typography variant="h6">{nonPRISMAText}</Typography>
                </CardContent>
                <CardActions sx={{ marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                    {curationIsComplete ? (
                        <StartExtractionButton size="medium" />
                    ) : columnIndex !== 0 ? (
                        <Button
                            disableElevation
                            onClick={() => {
                                handleSelectPreviousGroup();
                            }}
                        >
                            Go to Unreviewed
                        </Button>
                    ) : null}
                </CardActions>
            </Card>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHints;
