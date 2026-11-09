import { Box, Chip, Divider, ListItemText, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { filterAnalyses } from './grouping';
import { FITS } from './review';
import type { Fit } from './types';

interface Choice {
    key: string;
    name: string;
    points?: number;
}

/** The inside of the menu. Menu only mounts it while open, so the search starts empty
 * each time without any resetting. */
function MenuBody({
    analyses,
    current,
    fits,
    onSelect,
    onDescribe,
    onClose,
}: {
    analyses: Choice[];
    current: string | null;
    fits: Record<string, Fit | null>;
    onSelect: (key: string | null) => void;
    onDescribe?: () => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const shown = filterAnalyses(analyses, query);
    return (
        <Box>
            <Box
                sx={{ px: 2, pt: 1.5, pb: 1 }}
                // Typing in the search box must not trigger the menu's own type-ahead.
                onKeyDown={(event) => event.stopPropagation()}
            >
                <Typography variant="subtitle2" gutterBottom>
                    Assign to analysis
                </Typography>
                <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    placeholder="Search analyses"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    inputProps={{ 'aria-label': 'Search analyses' }}
                />
            </Box>
            <Divider />
            <Box sx={{ maxHeight: 300, overflow: 'auto', py: 0.5 }}>
                {current !== null && (
                    <MenuItem onClick={() => onSelect(null)}>
                        <ListItemText
                            primary="Unassigned maps"
                            secondary="Take it off this analysis"
                            primaryTypographyProps={{ variant: 'body2' }}
                        />
                    </MenuItem>
                )}
                {onDescribe && (
                    <MenuItem onClick={onDescribe}>
                        <ListItemText
                            primary="Not reported in the paper's tables"
                            secondary="Describe this map instead"
                            primaryTypographyProps={{ variant: 'body2' }}
                        />
                    </MenuItem>
                )}
                {analyses.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary="No analyses" primaryTypographyProps={{ variant: 'body2' }} />
                    </MenuItem>
                )}
                {analyses.length > 0 && shown.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary="No matching analyses" primaryTypographyProps={{ variant: 'body2' }} />
                    </MenuItem>
                )}
                {shown.map((analysis) => (
                    <MenuItem
                        key={analysis.key}
                        selected={analysis.key === current}
                        // Choosing where it already is just closes the menu.
                        onClick={() => (analysis.key === current ? onClose() : onSelect(analysis.key))}
                        sx={{ whiteSpace: 'normal', py: 1, px: 2 }}
                    >
                        <Stack spacing={0.25} alignItems="flex-start" sx={{ width: '100%' }}>
                            {analysis.points !== undefined && (
                                <Typography variant="caption" color="text.secondary">
                                    {analysis.points} coordinates
                                </Typography>
                            )}
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                {analysis.name}
                            </Typography>
                            {fits[analysis.key] && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    color={FITS[fits[analysis.key]!.outcome].tone}
                                    label={FITS[fits[analysis.key]!.outcome].label}
                                />
                            )}
                        </Stack>
                    </MenuItem>
                ))}
            </Box>
        </Box>
    );
}

/** The menu behind a map's three dots: a searchable list of the paper's analyses to move
 * it to, then whatever else can be done to it. ``current`` is the analysis it is on now
 * (null from the pool, which also hides "Unassigned maps"). */
export function AnalysisMenu({
    anchorEl,
    onClose,
    analyses,
    current,
    onSelect,
    fits = {},
    onDescribe,
    movable = true,
    children,
}: {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    analyses: Choice[];
    current: string | null;
    onSelect: (key: string | null) => void;
    /** How well the map fits each analysis (key to fit), shown beside it. */
    fits?: Record<string, Fit | null>;
    /** For a map not on an analysis: say the paper does not table it. */
    onDescribe?: () => void;
    /** False for a map that goes with its t/z map and so has nowhere of its own to go. */
    movable?: boolean;
    /** What else the author can do to this map, under the analyses. */
    children?: ReactNode;
}) {
    return (
        <Menu
            open={anchorEl !== null}
            anchorEl={anchorEl}
            onClose={onClose}
            MenuListProps={{ autoFocusItem: false, sx: { py: 0, width: 300 } }}
        >
            {movable && (
                <MenuBody
                    analyses={analyses}
                    current={current}
                    fits={fits}
                    onSelect={onSelect}
                    onDescribe={onDescribe}
                    onClose={onClose}
                />
            )}
            {children}
        </Menu>
    );
}
