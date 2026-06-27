import SearchIcon from '@mui/icons-material/Search';
import { Box, Divider, InputAdornment, ListItemText, Menu, MenuItem, TextField, Typography } from '@mui/material';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import React, { useEffect, useMemo, useState } from 'react';

export type SearchableAnalysisMenuProps = {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    analyses: AnalysisReturnNested[];
    onSelectAnalysis: (analysisId: string) => void;
    /** When set, that analysis is labeled "(current analysis)" and selecting it closes the menu without calling onSelectAnalysis. */
    currentAnalysisId?: string;
};

export const getAnalysisDisplayName = (analysis: { name?: string | null }): string => {
    const trimmedName = analysis.name?.trim();
    return trimmedName ? trimmedName : 'Untitled';
};

export const filterAnalysesBySearchQuery = (
    analyses: AnalysisReturnNested[],
    query: string
): AnalysisReturnNested[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return analyses;
    return analyses.filter((analysis) => getAnalysisDisplayName(analysis).toLowerCase().includes(normalizedQuery));
};

const SearchableAnalysisMenu: React.FC<SearchableAnalysisMenuProps> = ({
    open,
    anchorEl,
    onClose,
    analyses,
    onSelectAnalysis,
    currentAnalysisId,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!open) setSearchQuery('');
    }, [open]);

    const filteredAnalyses = useMemo(() => filterAnalysesBySearchQuery(analyses, searchQuery), [analyses, searchQuery]);

    return (
        <Menu
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            MenuListProps={{ autoFocusItem: false, sx: { py: 0, width: 300, maxHeight: 420 } }}
        >
            <Box
                sx={{ px: 2, pt: 1.5, pb: 1 }}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Move to analysis
                </Typography>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Search analyses"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    inputProps={{ 'aria-label': 'Search analyses', 'data-testid': 'analysis-move-menu-search' }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            <Divider />
            <Box className="sleek-scrollbar" sx={{ maxHeight: 300, overflow: 'auto', py: 0.5 }}>
                {analyses.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText
                            primary="No analyses yet"
                            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                    </MenuItem>
                )}
                {analyses.length > 0 && filteredAnalyses.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText
                            primary="No matching analyses"
                            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        />
                    </MenuItem>
                )}
                {filteredAnalyses.map((analysis) => {
                    const isCurrentAnalysis =
                        currentAnalysisId != null && analysis.id != null && analysis.id === currentAnalysisId;
                    const displayName = getAnalysisDisplayName(analysis);
                    const menuItemLabel = isCurrentAnalysis ? `${displayName} (current analysis)` : displayName;

                    return (
                        <MenuItem
                            key={analysis.id}
                            onClick={() => {
                                if (!analysis.id) return;
                                if (isCurrentAnalysis) {
                                    onClose();
                                    return;
                                }
                                onSelectAnalysis(analysis.id);
                            }}
                            sx={{ whiteSpace: 'normal', alignItems: 'flex-start', py: 1, px: 2 }}
                        >
                            <ListItemText
                                primary={menuItemLabel}
                                primaryTypographyProps={{
                                    variant: 'body2',
                                    color: !analysis.name?.trim() ? 'warning.dark' : undefined,
                                    sx: { whiteSpace: 'normal', wordBreak: 'break-word' },
                                }}
                                sx={{ minWidth: 0, m: 0 }}
                            />
                        </MenuItem>
                    );
                })}
            </Box>
        </Menu>
    );
};

export default SearchableAnalysisMenu;
