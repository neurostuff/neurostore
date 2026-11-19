import { Box, Chip, Divider, ListItemText, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { filterAnalyses } from './grouping';
import { FITS } from './review';
import type { Fit } from './types';

interface Choice {
    key: string;
    name: string;
    points?: number;
    /** How many maps are on it now. */
    count?: number;
    /** The t/z maps on it that an effect or variance map can go with. */
    maps?: MapChoice[];
}

interface MapChoice {
    id: string;
    name: string;
}

/** The inside of the menu. Menu only mounts it while open, so the search starts empty
 * each time without any resetting. */
function MenuBody({
    analyses,
    current,
    currentMap,
    fits,
    unplaced,
    title,
    onSelect,
    onSelectMap,
    onClose,
}: {
    analyses: Choice[];
    current: string | null;
    currentMap: string | null;
    fits: Record<string, Fit | null>;
    unplaced: MapChoice[];
    title: string;
    onSelect: (key: string) => void;
    onSelectMap?: (id: string) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const shown = filterAnalyses(analyses, query);
    // A t/z map to attach to: choosing it puts the map on that map's analyses.
    const mapItem = (map: MapChoice, under: string) => (
        <MenuItem
            key={`${under}/${map.id}`}
            dense
            selected={map.id === currentMap}
            onClick={() => (map.id === currentMap ? onClose() : onSelectMap?.(map.id))}
            sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', pl: 4, pr: 2, py: 0.25, minHeight: 0 }}
        >
            <Typography variant="body2" color="text.secondary" component="span" sx={{ mr: 1 }}>
                attach to
            </Typography>
            {map.name}
        </MenuItem>
    );
    return (
        <Box>
            <Box
                sx={{ px: 2, pt: 1, pb: 0.75 }}
                // Typing in the search box must not trigger the menu's own type-ahead.
                onKeyDown={(event) => event.stopPropagation()}
            >
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, lineHeight: 1.3 }}>
                    {title}
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
                    <Box key={analysis.key}>
                        <MenuItem
                            selected={analysis.key === current}
                            // Choosing where it already is just closes the menu.
                            onClick={() => (analysis.key === current ? onClose() : onSelect(analysis.key))}
                            sx={{ whiteSpace: 'normal', py: 0.5, px: 2, minHeight: 0 }}
                        >
                            <Stack spacing={0.125} alignItems="flex-start" sx={{ width: '100%' }}>
                                <Typography
                                    variant="body2"
                                    sx={{ wordBreak: 'break-word', fontSize: 13, lineHeight: 1.3 }}
                                >
                                    {analysis.name}
                                </Typography>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                    {(analysis.points !== undefined || analysis.count !== undefined) && (
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                                            {[
                                                analysis.points !== undefined && `${analysis.points} coordinates`,
                                                analysis.count !== undefined &&
                                                    `${analysis.count} ${analysis.count === 1 ? 'map' : 'maps'}`,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </Typography>
                                    )}
                                    {fits[analysis.key] && (
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            color={FITS[fits[analysis.key]!.outcome].tone}
                                            label={FITS[fits[analysis.key]!.outcome].label}
                                            sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }}
                                        />
                                    )}
                                </Stack>
                            </Stack>
                        </MenuItem>
                        {onSelectMap && analysis.maps?.map((map) => mapItem(map, analysis.key))}
                    </Box>
                ))}
                {onSelectMap && unplaced.length > 0 && (
                    <Box>
                        <Divider />
                        <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1, display: 'block' }}>
                            Not on an analysis yet
                        </Typography>
                        {unplaced.map((map) => mapItem(map, 'unplaced'))}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/** The menu behind a map's three dots: a searchable list of the paper's analyses to move
 * it to, then whatever else can be done to it. ``current`` is the analysis it is on now
 * (null from the pool). Taking a map off its analysis is not done here. */
export function AnalysisMenu({
    anchorEl,
    onClose,
    analyses,
    current,
    currentMap = null,
    onSelect,
    onSelectMap,
    unplaced = [],
    title = 'Assign to analysis',
    fits = {},
    movable = true,
    children,
}: {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    analyses: Choice[];
    current: string | null;
    onSelect: (key: string) => void;
    /** The t/z map the author picked (an effect or variance map only); omit for a t/z map. */
    onSelectMap?: (id: string) => void;
    /** The t/z map it is attached to now. */
    currentMap?: string | null;
    /** t/z maps on no analysis, offered after the analyses. */
    unplaced?: MapChoice[];
    title?: string;
    /** How well the map fits each analysis (key to fit), shown beside it. */
    fits?: Record<string, Fit | null>;
    /** False to hide the list (nothing to choose). */
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
                    currentMap={currentMap}
                    fits={fits}
                    unplaced={unplaced}
                    title={title}
                    onSelect={onSelect}
                    onSelectMap={onSelectMap}
                    onClose={onClose}
                />
            )}
            {children}
        </Menu>
    );
}
