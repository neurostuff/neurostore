import {
    Box,
    Chip,
    Paper,
    TableCell,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { getType } from 'components/EditMetadata/EditMetadata.types';
import { sortMetadataArrayFn } from 'pages/StudyCBMA/components/EditStudyMetadata';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import NeurosynthTable, { getValue } from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { Optional } from 'utils/utilitytypes';
import StudyAnalyses from 'pages/Study/components/StudyAnalyses';
import StudyAnalysesIBMA from 'pages/Study/components/StudyAnalysesIBMA';
import StudyStyles from './Study.styles';
import DisplayLink from 'components/DisplayStudyLink/DisplayLink';
import { PUBMED_ARTICLE_URL_PREFIX, PUBMED_CENTRAL_ARTICLE_URL_PREFIX } from 'hooks/external/useFetchPubMedIds.types';
import DisplayStudyLinkFullText from 'components/DisplayStudyLink/DisplayStudyLinkFullText';
import { IStoreAnalysis, IStoreStudy } from 'stores/study/StudyStore.helpers';
import { type MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

type StudyAnalysisView = 'CBMA' | 'IBMA';

const hasCBMAAnalyses = (analyses: IStoreAnalysis[]): boolean =>
    analyses.some((analysis) => (analysis.point_count ?? 0) > 0 || (analysis.points?.length ?? 0) > 0);

const hasIBMAAnalyses = (analyses: IStoreAnalysis[]): boolean =>
    analyses.some((analysis) => (analysis.images?.length ?? 0) > 0);

const resolveAnalysisView = (
    typeParam: string | null,
    showCBMA: boolean,
    showIBMA: boolean
): StudyAnalysisView => {
    if (showIBMA && !showCBMA) return 'IBMA';
    if (showCBMA && showIBMA && typeParam === 'ibma') return 'IBMA';
    return 'CBMA';
};

const Study = (props: Optional<IStoreStudy, 'metadata'>) => {
    const { id, name, description, doi, pmid, authors, publication: journal, metadata, pmcid, analyses = [] } = props;
    const [searchParams, setSearchParams] = useSearchParams();

    const hasIBMA = hasIBMAAnalyses(analyses);
    const hasCBMA = hasCBMAAnalyses(analyses);
    const showIBMA = hasIBMA;
    const showCBMA = hasCBMA || !hasIBMA;

    const analysisView = resolveAnalysisView(searchParams.get('type')?.toLowerCase() ?? null, showCBMA, showIBMA);

    const handleAnalysisViewChange = (_event: MouseEvent<HTMLElement>, nextView: StudyAnalysisView | null) => {
        if (nextView === null) return;
        setSearchParams(
            (previous) => {
                const nextParams = new URLSearchParams(previous);
                nextParams.set('type', nextView.toLowerCase());
                return nextParams;
            },
            { replace: true }
        );
    };

    return (
        <Box>
            <Box data-tour="StudyPage-1">
                <Box>
                    {id && (
                        <Chip
                            variant="filled"
                            color="primary"
                            sx={{ marginRight: '5px', borderRadius: '8px', marginBottom: '0.5rem' }}
                            size="medium"
                            label={id ? `Version: ${id}` : ''}
                        />
                    )}
                    <Typography variant="h6">
                        <b>{name}</b>
                    </Typography>
                </Box>
                <Typography>{authors}</Typography>
                <Box>
                    <Typography gutterBottom>{journal}</Typography>
                    <Box sx={{ marginBottom: '0.7rem', display: 'flex' }}>
                        {doi && (
                            <DisplayLink
                                sx={{ marginRight: '1rem' }}
                                label="DOI Link"
                                href={`https://doi.org/${doi}`}
                            />
                        )}
                        {pmid && (
                            <DisplayLink
                                sx={{ marginRight: '1rem' }}
                                label="Pubmed Study"
                                href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                            />
                        )}
                        {pmcid && (
                            <Tooltip placement="top" title="View the full article in HTML form via PubMed Central">
                                <DisplayLink
                                    sx={{ marginRight: '1rem' }}
                                    label="Full Text (web)"
                                    href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${pmcid}`}
                                />
                            </Tooltip>
                        )}
                        {name && <DisplayStudyLinkFullText sx={{ marginRight: '1rem' }} studyName={name} />}
                    </Box>
                </Box>
                <TextExpansion
                    text={description || ''}
                    sx={{
                        margin: '8px 0',
                        color: 'gray',
                        whiteSpace: 'pre-wrap',
                    }}
                />
            </Box>
            {metadata && (
                <Box data-tour="StudyPage-2" sx={{ margin: '1rem 0' }}>
                    <NeurosynthAccordion
                        elevation={0}
                        expandIconColor={'primary.main'}
                        sx={{
                            border: '1px solid',
                            borderColor: 'primary.main',
                        }}
                        accordionSummarySx={{
                            ':hover': {
                                backgroundColor: '#f2f2f2',
                            },
                        }}
                        TitleElement={<Typography sx={{ color: 'primary.main' }}>Metadata</Typography>}
                    >
                        <Box sx={StudyStyles.metadataContainer}>
                            <NeurosynthTable
                                tableConfig={{
                                    noDataDisplay: (
                                        <Typography sx={{ color: 'warning.dark', margin: '1rem' }}>
                                            No metadata
                                        </Typography>
                                    ),
                                    tableHeaderBackgroundColor: 'white',
                                    tableElevation: 0,
                                }}
                                headerCells={[
                                    { text: 'Name', key: 'name', styles: { fontWeight: 'bold' } },
                                    { text: 'Value', key: 'value', styles: { fontWeight: 'bold' } },
                                ]}
                                rows={metadata
                                    .sort((a, b) => sortMetadataArrayFn(a.metadataKey, b.metadataKey))
                                    .map(({ metadataKey, metadataValue }) => (
                                        <TableRow key={metadataKey}>
                                            <TableCell>{metadataKey}</TableCell>
                                            <TableCell
                                                sx={{
                                                    color: NeurosynthTableStyles[getType(metadataValue)],
                                                }}
                                            >
                                                {getValue(metadataValue)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            />
                        </Box>
                    </NeurosynthAccordion>
                </Box>
            )}

            <Box>
                <Paper
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, mb: 2 }}
                    variant="outlined"
                >
                    <Typography data-tour="StudyPage-3" variant="h6" fontWeight="bold">
                        Analyses
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        color="primary"
                        value={analysisView}
                        onChange={handleAnalysisViewChange}
                        aria-label="Analysis view type"
                    >
                        {showCBMA && (
                            <ToggleButton sx={{ px: 2 }} value="CBMA">
                                CBMA
                            </ToggleButton>
                        )}
                        {showIBMA && (
                            <ToggleButton sx={{ px: 2 }} value="IBMA">
                                IBMA
                            </ToggleButton>
                        )}
                    </ToggleButtonGroup>
                </Paper>
                {analyses?.length === 0 ? (
                    <Box sx={{ color: 'warning.dark', margin: '15px 0 0 15px' }}>
                        There are no analyses for this study.
                    </Box>
                ) : (
                    <Box sx={{ marginBottom: '1rem' }}>
                        {analysisView === 'CBMA' ? (
                            <StudyAnalyses id={id} analyses={analyses} />
                        ) : (
                            <StudyAnalysesIBMA id={id} analyses={analyses} />
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Study;
