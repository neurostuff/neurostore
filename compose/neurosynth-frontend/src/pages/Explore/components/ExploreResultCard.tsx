import { Box, Chip, Typography } from '@mui/material';
import { getExploreChipSx } from 'pages/Explore/Explore.helpers';
import { MockBrainMap } from 'pages/Explore/Explore.mockData';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type ExploreResultCardProps = {
    brainMap: MockBrainMap;
    selectedOnvocLabels: string[];
};

const SOURCE_TYPE_LABEL: Record<MockBrainMap['source'], string> = {
    neurostore: 'ONVOC',
    legacy: 'Legacy',
    user: 'User',
};

const SOURCE_CHIP_SX: Record<MockBrainMap['source'], object> = {
    neurostore: {
        borderColor: 'success.main',
        color: 'success.dark',
    },
    legacy: {
        borderColor: 'muted.main',
        color: 'text.secondary',
    },
    user: {
        borderColor: 'primary.light',
        color: 'primary.dark',
    },
};

const ExploreResultCard = ({ brainMap, selectedOnvocLabels }: ExploreResultCardProps) => {
    const selectedOnvocLabelSet = new Set(selectedOnvocLabels.map((label) => label.toLowerCase()));
    const [placeholderStats] = useState(() => ({
        studyCount: Math.floor(Math.random() * 90) + 10,
        analysisCount: Math.floor(Math.random() * 400) + 50,
        coordinateCount: Math.floor(Math.random() * 9000) + 500,
    }));
    const sourceLabel = SOURCE_TYPE_LABEL[brainMap.source];

    return (
        <Box
            sx={{
                py: 2.5,
                px: { xs: 0, sm: 0.5 },
            }}
        >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <Chip
                    label={brainMap.analysisType}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        '& .MuiChip-label': { px: 1.25 },
                    }}
                />
                <Chip
                    label={sourceLabel}
                    size="small"
                    variant="outlined"
                    sx={{
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        borderWidth: 1.5,
                        bgcolor: 'transparent',
                        ...SOURCE_CHIP_SX[brainMap.source],
                        '& .MuiChip-label': { px: 1.25 },
                    }}
                />
            </Box>

            <Typography
                component={RouterLink}
                to={`/meta-analyses/${brainMap.id}`}
                variant="h6"
                sx={{
                    color: 'primary.main',
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    lineHeight: 1.35,
                    mb: 0.75,
                    textDecoration: 'none',
                    display: 'block',
                    '&:hover': {
                        textDecoration: 'underline',
                        color: 'primary.dark',
                    },
                }}
            >
                {brainMap.title}
            </Typography>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: 'block',
                    fontWeight: 500,
                    letterSpacing: '0.01em',
                }}
            >
                {placeholderStats.studyCount.toLocaleString()} studies ·{' '}
                {placeholderStats.analysisCount.toLocaleString()} analyses ·{' '}
                {placeholderStats.coordinateCount.toLocaleString()} coordinates
            </Typography>

            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    mb: 1.75,
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {brainMap.abstract}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {[...brainMap.onvocTerms]
                    .sort((left, right) => left.localeCompare(right))
                    .map((term) => {
                        const isSelectedMatch = selectedOnvocLabelSet.has(term.toLowerCase());
                        return (
                            <Chip
                                key={term}
                                label={term}
                                size="small"
                                variant={isSelectedMatch ? 'filled' : 'outlined'}
                                clickable
                                component="button"
                                type="button"
                                sx={{
                                    borderRadius: '4px',
                                    ...getExploreChipSx(term, isSelectedMatch),
                                }}
                            />
                        );
                    })}
            </Box>
        </Box>
    );
};

export default ExploreResultCard;
