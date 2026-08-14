import {
    Autocomplete,
    Box,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    InputAdornment,
    InputLabel,
    MenuItem,
    Pagination,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageMetadata } from '../../../seo/hooks';
import onvocConfig from 'assets/config/onvoc-1.0.0.json';
import {
    collectOnvocLeafLabels,
    getOnvocLabelById,
    getOnvocLeafIdByLabel,
    MOCK_BRAIN_MAPS,
    OnvocTreeNode,
} from 'pages/Explore/Explore.mockData';
import ExploreActiveFilters, { ExploreActiveFilterChip } from 'pages/Explore/components/ExploreActiveFilters';
import ExploreResultCard from 'pages/Explore/components/ExploreResultCard';
import OnvocTreeFilter from 'pages/Explore/components/OnvocTreeFilter';

const ONVOC_TREE = onvocConfig.tree as OnvocTreeNode[];

const ONVOC_SEARCH_OPTIONS = Array.from(new Set(collectOnvocLeafLabels(ONVOC_TREE))).sort((left, right) =>
    left.localeCompare(right)
);

const ONVOC_FILTER_CATEGORY_LABELS = ['Disorders', 'Psychological Concepts', 'Population Characteristics'] as const;

const META_ANALYSIS_TYPE_LABELS: Record<string, string> = {
    fMRI: 'IBMA',
    PET: 'CBMA',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 99] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

type ExploreUrlFilters = {
    q: string;
    onvoc: string[];
    type: string;
    showLegacy: boolean;
    showUser: boolean;
    page: number;
    pageSize: number;
};

type ExplorePaginationBarProps = {
    currentPage: number;
    totalPageCount: number;
    onPageChange: (page: number) => void;
    resultSummary: string;
    pageSize: number;
    onPageSizeChange: (nextPageSize: number) => void;
    pageSizeLabelId: string;
    sx?: object;
};

const ExplorePaginationBar = ({
    currentPage,
    totalPageCount,
    onPageChange,
    resultSummary,
    pageSize,
    onPageSizeChange,
    pageSizeLabelId,
    sx,
}: ExplorePaginationBarProps) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            ...sx,
        }}
    >
        <Pagination
            siblingCount={2}
            boundaryCount={2}
            showFirstButton
            showLastButton
            page={currentPage}
            count={totalPageCount}
            onChange={(_event, page) => onPageChange(page)}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
                {resultSummary}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel id={pageSizeLabelId}>Page size</InputLabel>
                <Select
                    labelId={pageSizeLabelId}
                    label="Page size"
                    value={pageSize}
                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    </Box>
);

const getOnvocCategoryChildNodes = (categoryLabel: string): OnvocTreeNode[] => {
    const categoryNode = ONVOC_TREE.find((node) => node.label === categoryLabel);
    return categoryNode?.children ?? [];
};

const parseExploreUrlFilters = (searchParams: URLSearchParams): ExploreUrlFilters => {
    const typeParam = searchParams.get('type');
    const type = typeParam === 'fMRI' || typeParam === 'PET' ? typeParam : 'all';

    const pageSizeParam = Number(searchParams.get('pageSize'));
    const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam)
        ? pageSizeParam
        : DEFAULT_PAGE_SIZE;

    const pageParam = Number(searchParams.get('page'));
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

    return {
        q: searchParams.get('q') ?? '',
        onvoc: searchParams.getAll('onvoc').filter(Boolean),
        type,
        showLegacy: searchParams.get('legacy') !== '0',
        showUser: searchParams.get('user') !== '0',
        page,
        pageSize,
    };
};

const buildExploreSearchParams = (filters: ExploreUrlFilters): URLSearchParams => {
    const nextParams = new URLSearchParams();
    const trimmedQuery = filters.q.trim();

    if (trimmedQuery) {
        nextParams.set('q', trimmedQuery);
    }
    filters.onvoc.forEach((leafId) => {
        nextParams.append('onvoc', leafId);
    });
    if (filters.type !== 'all') {
        nextParams.set('type', filters.type);
    }
    if (!filters.showLegacy) {
        nextParams.set('legacy', '0');
    }
    if (!filters.showUser) {
        nextParams.set('user', '0');
    }
    if (filters.page > 1) {
        nextParams.set('page', String(filters.page));
    }
    if (filters.pageSize !== DEFAULT_PAGE_SIZE) {
        nextParams.set('pageSize', String(filters.pageSize));
    }

    return nextParams;
};

const ExplorePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlFilters = useMemo(() => parseExploreUrlFilters(searchParams), [searchParams]);

    const {
        q: activeQuery,
        onvoc: selectedLeafIds,
        type: modalityFilter,
        showLegacy: showLegacyNeurosynthResults,
        showUser: showUserResults,
        page: pageOfResults,
        pageSize,
    } = urlFilters;

    const [searchInput, setSearchInput] = useState(activeQuery);

    usePageMetadata({
        title: 'Explore Brain Maps | Neurosynth Compose',
        description: 'Browse and filter neuroimaging brain maps using ONVOC vocabulary terms.',
        canonicalPath: '/explore',
    });

    useEffect(() => {
        setSearchInput(activeQuery);
    }, [activeQuery]);

    const writeUrlFilters = (nextFilters: ExploreUrlFilters) => {
        setSearchParams(buildExploreSearchParams(nextFilters), { replace: true });
    };

    const patchUrlFilters = (patch: Partial<ExploreUrlFilters>, options?: { resetPage?: boolean }) => {
        const shouldResetPage = options?.resetPage ?? patch.page === undefined;
        writeUrlFilters({
            ...urlFilters,
            ...patch,
            page: shouldResetPage ? 1 : (patch.page ?? urlFilters.page),
        });
    };

    const selectedOnvocLabels = useMemo(
        () =>
            selectedLeafIds
                .map((leafId) => getOnvocLabelById(ONVOC_TREE, leafId))
                .filter((label): label is string => Boolean(label)),
        [selectedLeafIds]
    );

    const filteredMaps = useMemo(() => {
        const normalizedQuery = activeQuery.trim().toLowerCase();

        return MOCK_BRAIN_MAPS.filter((brainMap) => {
            const matchesQuery =
                !normalizedQuery ||
                brainMap.title.toLowerCase().includes(normalizedQuery) ||
                brainMap.abstract.toLowerCase().includes(normalizedQuery) ||
                brainMap.onvocTerms.some((term) => term.toLowerCase().includes(normalizedQuery));

            const matchesOnvoc =
                selectedOnvocLabels.length === 0 ||
                selectedOnvocLabels.some((label) =>
                    brainMap.onvocTerms.some((term) => term.toLowerCase() === label.toLowerCase())
                );

            const matchesModality = modalityFilter === 'all' || brainMap.modality === modalityFilter;

            const matchesSource =
                brainMap.source === 'neurostore' ||
                (showUserResults && brainMap.source === 'user') ||
                (showLegacyNeurosynthResults && brainMap.source === 'legacy');

            return matchesQuery && matchesOnvoc && matchesModality && matchesSource;
        });
    }, [
        activeQuery,
        selectedOnvocLabels,
        modalityFilter,
        showUserResults,
        showLegacyNeurosynthResults,
    ]);

    const totalPageCount = Math.max(1, Math.ceil(filteredMaps.length / pageSize));
    const currentPage = Math.min(pageOfResults, totalPageCount);
    const paginatedMaps = filteredMaps.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
        if (pageOfResults <= totalPageCount) {
            return;
        }
        setSearchParams(buildExploreSearchParams({ ...urlFilters, page: totalPageCount }), { replace: true });
    }, [pageOfResults, totalPageCount, urlFilters, setSearchParams]);

    const applySearchQuery = (query: string) => {
        patchUrlFilters({ q: query.trim() });
    };

    const setSelectedLeafIds = (nextLeafIds: string[] | ((previousLeafIds: string[]) => string[])) => {
        const resolvedLeafIds =
            typeof nextLeafIds === 'function' ? nextLeafIds(selectedLeafIds) : nextLeafIds;
        patchUrlFilters({ onvoc: resolvedLeafIds });
    };

    const submitSearchOrOnvocFilter = (rawQuery: string) => {
        const trimmedQuery = rawQuery.trim();
        if (!trimmedQuery) {
            applySearchQuery('');
            return;
        }

        const matchingLeafId = getOnvocLeafIdByLabel(ONVOC_TREE, trimmedQuery);
        if (matchingLeafId) {
            setSelectedLeafIds((previousLeafIds) =>
                previousLeafIds.includes(matchingLeafId) ? previousLeafIds : [...previousLeafIds, matchingLeafId]
            );
            setSearchInput('');
            return;
        }

        applySearchQuery(trimmedQuery);
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        submitSearchOrOnvocFilter(searchInput);
    };

    const clearSearchQuery = () => {
        setSearchInput('');
        applySearchQuery('');
    };

    const activeFilters: ExploreActiveFilterChip[] = [];

    if (activeQuery.trim()) {
        activeFilters.push({
            id: 'search',
            label: `Search: ${activeQuery.trim()}`,
            onClear: clearSearchQuery,
        });
    }

    if (modalityFilter !== 'all') {
        activeFilters.push({
            id: 'meta-analysis-type',
            label: `Type: ${META_ANALYSIS_TYPE_LABELS[modalityFilter] ?? modalityFilter}`,
            onClear: () => patchUrlFilters({ type: 'all' }),
        });
    }

    selectedLeafIds.forEach((leafId) => {
        const label = getOnvocLabelById(ONVOC_TREE, leafId);
        if (!label) {
            return;
        }
        activeFilters.push({
            id: `onvoc-${leafId}`,
            label,
            onClear: () => setSelectedLeafIds((previous) => previous.filter((id) => id !== leafId)),
            useTextColor: true,
        });
    });

    if (!showLegacyNeurosynthResults) {
        activeFilters.push({
            id: 'hide-legacy',
            label: 'Hide legacy neurosynth results',
            onClear: () => patchUrlFilters({ showLegacy: true }),
        });
    }

    if (!showUserResults) {
        activeFilters.push({
            id: 'hide-user',
            label: 'Hide results from users',
            onClear: () => patchUrlFilters({ showUser: true }),
        });
    }

    const handleClearAllFilters = () => {
        setSearchInput('');
        writeUrlFilters({
            q: '',
            onvoc: [],
            type: 'all',
            showLegacy: true,
            showUser: true,
            page: 1,
            pageSize,
        });
    };

    const resultSummary = `${filteredMaps.length} result${filteredMaps.length === 1 ? '' : 's'}`;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
                alignItems: 'flex-start',
                width: '100%',
            }}
        >
            <Box
                component="aside"
                sx={{
                    width: { xs: '100%', md: 320 },
                    px: 2,
                    boxSizing: 'border-box',
                    flexShrink: 0,
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Filters
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="explore-modality-label">Meta Analysis Type</InputLabel>
                    <Select
                        labelId="explore-modality-label"
                        label="Meta Analysis Type"
                        value={modalityFilter}
                        onChange={(event) => patchUrlFilters({ type: event.target.value })}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="fMRI">IBMA</MenuItem>
                        <MenuItem value="PET">CBMA</MenuItem>
                    </Select>
                </FormControl>
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {ONVOC_FILTER_CATEGORY_LABELS.map((categoryLabel) => (
                        <OnvocTreeFilter
                            key={categoryLabel}
                            title={categoryLabel}
                            nodes={getOnvocCategoryChildNodes(categoryLabel)}
                            selectedLeafIds={selectedLeafIds}
                            onSelectedLeafIdsChange={setSelectedLeafIds}
                        />
                    ))}
                </Box>
                <FormGroup>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showLegacyNeurosynthResults}
                                onChange={(_event, checked) => patchUrlFilters({ showLegacy: checked })}
                                size="small"
                            />
                        }
                        label="Show legacy neurosynth results"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showUserResults}
                                onChange={(_event, checked) => patchUrlFilters({ showUser: checked })}
                                size="small"
                            />
                        }
                        label="Show results from users"
                    />
                </FormGroup>
            </Box>

            <Box component="main" sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                    Explore Meta-Analyses
                </Typography>

                <Box component="form" onSubmit={handleSearchSubmit} sx={{ mb: 2 }}>
                    <Autocomplete
                        freeSolo
                        fullWidth
                        options={ONVOC_SEARCH_OPTIONS}
                        inputValue={searchInput}
                        onInputChange={(_event, value, reason) => {
                            if (reason === 'reset') {
                                return;
                            }
                            setSearchInput(value);
                        }}
                        onChange={(_event, value) => {
                            if (value == null) {
                                return;
                            }
                            submitSearchOrOnvocFilter(value);
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Search brain maps, tasks, or ONVOC terms…"
                                inputProps={{
                                    ...params.inputProps,
                                    'aria-label': 'Search brain maps',
                                }}
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <>
                                            <InputAdornment position="start">
                                                <Search color="action" />
                                            </InputAdornment>
                                            {params.InputProps.startAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />
                </Box>

                <ExploreActiveFilters filters={activeFilters} onClearAll={handleClearAllFilters} />

                <ExplorePaginationBar
                    currentPage={currentPage}
                    totalPageCount={totalPageCount}
                    onPageChange={(page) => patchUrlFilters({ page }, { resetPage: false })}
                    resultSummary={resultSummary}
                    pageSize={pageSize}
                    onPageSizeChange={(nextPageSize) => patchUrlFilters({ pageSize: nextPageSize })}
                    pageSizeLabelId="explore-page-size-label-top"
                    sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {filteredMaps.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                            No brain maps match the current filters. Try clearing ONVOC terms or broadening your search.
                        </Typography>
                    ) : (
                        paginatedMaps.map((brainMap) => (
                            <ExploreResultCard
                                key={brainMap.id}
                                brainMap={brainMap}
                                selectedOnvocLabels={selectedOnvocLabels}
                            />
                        ))
                    )}
                </Box>

                {filteredMaps.length > 0 && (
                    <ExplorePaginationBar
                        currentPage={currentPage}
                        totalPageCount={totalPageCount}
                        onPageChange={(page) => patchUrlFilters({ page }, { resetPage: false })}
                        resultSummary={resultSummary}
                        pageSize={pageSize}
                        onPageSizeChange={(nextPageSize) => patchUrlFilters({ pageSize: nextPageSize })}
                        pageSizeLabelId="explore-page-size-label-bottom"
                        sx={{ mt: 2 }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default ExplorePage;
