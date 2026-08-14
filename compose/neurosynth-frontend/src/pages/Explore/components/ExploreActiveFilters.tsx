import { Box, Button, Chip } from '@mui/material';
import { getExploreChipSx } from 'pages/Explore/Explore.helpers';

export type ExploreActiveFilterChip = {
    id: string;
    label: string;
    onClear: () => void;
    /** When true, uses deterministic text-to-color styling (ONVOC terms only). */
    useTextColor?: boolean;
};

type ExploreActiveFiltersProps = {
    filters: ExploreActiveFilterChip[];
    onClearAll: () => void;
};

const ExploreActiveFilters = ({ filters, onClearAll }: ExploreActiveFiltersProps) => {
    if (filters.length === 0) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 2 }}>
            {filters.map((filter) => (
                <Chip
                    key={filter.id}
                    label={filter.label}
                    size="small"
                    onDelete={filter.onClear}
                    variant={filter.useTextColor ? 'filled' : 'outlined'}
                    color={filter.useTextColor ? undefined : 'default'}
                    sx={filter.useTextColor ? getExploreChipSx(filter.label, true) : undefined}
                />
            ))}
            <Button size="small" onClick={onClearAll} sx={{ textTransform: 'none', minWidth: 0, px: 0.5 }}>
                Clear all
            </Button>
        </Box>
    );
};

export default ExploreActiveFilters;
