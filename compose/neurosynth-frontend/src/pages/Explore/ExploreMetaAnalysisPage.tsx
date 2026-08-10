import { Box, Button, Chip, Stack, Tab, Tabs, Typography } from '@mui/material';
import MetaAnalysisPageStyles from 'pages/MetaAnalysis/MetaAnalysisPage.styles';
import { MockBrainMap } from 'pages/Explore/Explore.mockData';
import { useState } from 'react';

type ExploreMetaAnalysisPageProps = {
    brainMap: MockBrainMap;
};

/**
 * Explore wireframe of the meta-analysis detail page.
 * Mirrors MetaAnalysisPage layout (name, description, details tabs) without project breadcrumbs,
 * and uses mock Explore brain-map data instead of API-backed project resources.
 */
const ExploreMetaAnalysisPage = ({ brainMap }: ExploreMetaAnalysisPageProps) => {
    const [tab, setTab] = useState(0);

    return (
        <Box>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                justifyContent="space-between"
                gap={2}
                sx={{ mb: 1 }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography sx={MetaAnalysisPageStyles.displayedText} variant="h5">
                            {brainMap.title}
                        </Typography>
                    </Box>
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography
                            sx={[MetaAnalysisPageStyles.displayedText, MetaAnalysisPageStyles.description]}
                        >
                            {brainMap.abstract}
                        </Typography>
                    </Box>
                    <Box sx={{ mt: 0.5 }}>
                        {brainMap.source === 'legacy' ? (
                            <Chip
                                variant="filled"
                                size="small"
                                label="Legacy Neurosynth"
                                sx={{ color: 'muted.dark', mt: '0.25rem' }}
                            />
                        ) : (
                            <Chip
                                variant="filled"
                                size="small"
                                label={`Analysis type: ${brainMap.analysisType}`}
                                sx={{ color: 'muted.dark', mt: '0.25rem' }}
                            />
                        )}
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                        {brainMap.onvocTerms.map((term) => (
                            <Chip
                                key={term}
                                size="small"
                                variant="outlined"
                                color="primary"
                                label={term}
                                clickable
                                component="button"
                                type="button"
                            />
                        ))}
                    </Stack>
                </Box>
                <Stack direction="row" spacing={1} flexShrink={0}>
                    <Button variant="outlined">View Project</Button>
                    <Button variant="contained">Clone and Edit</Button>
                </Stack>
            </Stack>

            <Tabs
                sx={{
                    mt: 2,
                    '.MuiTabs-flexContainer': {
                        borderBottom: '1px solid lightgray',
                    },
                    '.MuiButtonBase-root.Mui-selected': {
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderTopLeftRadius: '6px',
                        borderTopRightRadius: '6px',
                        borderColor: 'lightgray',
                        borderBottom: '0px',
                        marginBottom: '-2px',
                    },
                    transition: 'none',
                }}
                TabIndicatorProps={{
                    sx: {
                        display: 'none',
                    },
                }}
                value={tab}
                onChange={(_event, newValue: number) => setTab(newValue)}
            >
                <Tab value={0} label="Meta Analysis Results" />
                <Tab value={1} label="View Specification" />
                <Tab value={2} label="Cite Me" />
            </Tabs>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, p: 3 }}>
                {tab === 0 && (
                    <Typography color="text.secondary">
                        Wireframe: meta-analysis results for “{brainMap.title}” would appear here (maps, tables,
                        downloads).
                    </Typography>
                )}
                {tab === 1 && (
                    <Typography color="text.secondary">
                        Wireframe: specification details for this {brainMap.analysisType} analysis would appear here
                        (algorithm, studyset, inclusion criteria).
                    </Typography>
                )}
                {tab === 2 && (
                    <Typography color="text.secondary">
                        Wireframe: citation / cite-me content for this meta-analysis would appear here.
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default ExploreMetaAnalysisPage;
