import { Box, Chip, Typography } from '@mui/material';
import { MockBrainMap } from 'pages/Explore/Explore.mockData';
import { Link as RouterLink } from 'react-router-dom';

type ExploreResultCardProps = {
    brainMap: MockBrainMap;
};

const ExploreResultCard = ({ brainMap }: ExploreResultCardProps) => {
    return (
        <Box sx={{ py: 1 }}>
            <Typography
                component={RouterLink}
                to={`/meta-analyses/${brainMap.id}`}
                variant="h6"
                sx={{
                    color: 'primary.main',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    lineHeight: 1.35,
                    mb: 0.5,
                    textDecoration: 'none',
                    display: 'block',
                    '&:hover': {
                        textDecoration: 'underline',
                    },
                }}
            >
                {brainMap.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {brainMap.analysisType}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                23 studies · 213 analyses · 3,912 coordinates
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                ONVOC | LEGACY | USER
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55 }}>
                {brainMap.abstract}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {brainMap.onvocTerms.map((term) => (
                    <Chip
                        key={term}
                        label={term}
                        size="small"
                        variant="outlined"
                        color="primary"
                        clickable
                        component="button"
                        type="button"
                    />
                ))}
            </Box>
        </Box>
    );
};

export default ExploreResultCard;
