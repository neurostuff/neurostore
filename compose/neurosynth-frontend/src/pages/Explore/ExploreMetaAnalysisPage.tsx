import { Box, Button, Chip, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import onvocConfig from 'assets/config/onvoc-1.0.0.json';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import { getExploreChipSx } from 'pages/Explore/Explore.helpers';
import { getOnvocLeafIdByLabel, MOCK_BRAIN_MAPS, MockBrainMap, OnvocTreeNode } from 'pages/Explore/Explore.mockData';
import MetaAnalysisPageStyles from 'pages/MetaAnalysis/MetaAnalysisPage.styles';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const ONVOC_TREE = onvocConfig.tree as OnvocTreeNode[];

type ExploreMetaAnalysisPageProps = {
    brainMap: MockBrainMap;
};

const getRelatedOnvocTerms = (brainMap: MockBrainMap): string[] => {
    const currentTermSet = new Set(brainMap.onvocTerms.map((term) => term.toLowerCase()));
    const relatedTermSet = new Set<string>();

    MOCK_BRAIN_MAPS.forEach((otherMap) => {
        if (otherMap.id === brainMap.id) {
            return;
        }
        const sharesTerm = otherMap.onvocTerms.some((term) => currentTermSet.has(term.toLowerCase()));
        if (!sharesTerm) {
            return;
        }
        otherMap.onvocTerms.forEach((term) => {
            if (!currentTermSet.has(term.toLowerCase())) {
                relatedTermSet.add(term);
            }
        });
    });

    if (relatedTermSet.size === 0) {
        MOCK_BRAIN_MAPS.forEach((otherMap) => {
            if (otherMap.id === brainMap.id) {
                return;
            }
            otherMap.onvocTerms.forEach((term) => {
                if (!currentTermSet.has(term.toLowerCase())) {
                    relatedTermSet.add(term);
                }
            });
        });
    }

    return Array.from(relatedTermSet).sort((left, right) => left.localeCompare(right));
};

/**
 * Explore wireframe of the meta-analysis detail page.
 * Mirrors MetaAnalysisPage layout (name, description, details tabs) without project breadcrumbs,
 * and uses mock Explore brain-map data instead of API-backed project resources.
 */
const ExploreMetaAnalysisPage = ({ brainMap }: ExploreMetaAnalysisPageProps) => {
    const [tab, setTab] = useState(0);
    const relatedOnvocTerms = useMemo(() => getRelatedOnvocTerms(brainMap), [brainMap]);

    return (
        <Box>
            <NeurosynthBreadcrumbs
                breadcrumbItems={[
                    {
                        link: '/explore',
                        text: 'Explore',
                        isCurrentPage: false,
                    },
                    {
                        link: '',
                        text: brainMap.title,
                        isCurrentPage: true,
                    },
                ]}
            />

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                justifyContent="space-between"
                gap={2}
                sx={{ mb: 1, mt: 1 }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography sx={MetaAnalysisPageStyles.displayedText} variant="h5">
                            {brainMap.title}
                        </Typography>
                    </Box>
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography sx={[MetaAnalysisPageStyles.displayedText, MetaAnalysisPageStyles.description]}>
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
                        ) : brainMap.source === 'neurostore' ? (
                            <Chip
                                variant="filled"
                                size="small"
                                label="ONVOC"
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
                        {[...brainMap.onvocTerms]
                            .sort((left, right) => left.localeCompare(right))
                            .map((term) => (
                                <Chip
                                    key={term}
                                    size="small"
                                    variant="outlined"
                                    label={term}
                                    clickable
                                    component="button"
                                    type="button"
                                    sx={{
                                        borderRadius: '4px',
                                        ...getExploreChipSx(term, false),
                                    }}
                                />
                            ))}
                    </Stack>
                </Box>
                <Stack direction="row" spacing={1} flexShrink={0}>
                    <Button variant="outlined">View Project</Button>
                    <Button variant="contained">Clone and Edit</Button>
                </Stack>
            </Stack>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: 'flex-start',
                    gap: 3,
                    mt: 2,
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                    <Tabs
                        sx={{
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

                    <Box sx={{ borderTop: 0, p: 3, minHeight: 220 }}>
                        {tab === 0 && (
                            <Box>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    Wireframe: NiiVue visualizer placeholder for “{brainMap.title}”.
                                </Typography>
                                <Skeleton
                                    variant="rectangular"
                                    animation="wave"
                                    sx={{
                                        width: '100%',
                                        height: 300,
                                        transform: 'none',
                                        borderRadius: 1,
                                    }}
                                />
                            </Box>
                        )}
                        {tab === 1 && (
                            <Typography color="text.secondary">
                                Wireframe: specification details for this {brainMap.analysisType} analysis would appear
                                here (algorithm, studyset, inclusion criteria).
                            </Typography>
                        )}
                        {tab === 2 && (
                            <Typography color="text.secondary">
                                Wireframe: citation / cite-me content for this meta-analysis would appear here.
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Box
                    component="aside"
                    sx={{
                        width: { xs: '100%', md: 280 },
                        flexShrink: 0,
                        p: 2,
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Related ONVOC terms
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                        (Is there anything else we can put here? topic modeling where this meta-analysis or its related
                        terms were found?)
                    </Typography>
                    {relatedOnvocTerms.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No related terms yet.
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {relatedOnvocTerms.map((term) => {
                                const leafId = getOnvocLeafIdByLabel(ONVOC_TREE, term);
                                const chipSx = {
                                    borderRadius: '4px',
                                    ...getExploreChipSx(term, false),
                                };

                                if (leafId) {
                                    return (
                                        <Chip
                                            key={term}
                                            size="small"
                                            variant="outlined"
                                            label={term}
                                            clickable
                                            component={RouterLink}
                                            to={`/explore?onvoc=${encodeURIComponent(leafId)}`}
                                            sx={chipSx}
                                        />
                                    );
                                }

                                return (
                                    <Chip
                                        key={term}
                                        size="small"
                                        variant="outlined"
                                        label={term}
                                        clickable
                                        component="button"
                                        type="button"
                                        sx={chipSx}
                                    />
                                );
                            })}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default ExploreMetaAnalysisPage;
