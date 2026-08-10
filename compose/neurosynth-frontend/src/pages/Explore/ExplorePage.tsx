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
    Select,
    TextField,
    Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageMetadata } from '../../../seo/hooks';
import { getOnvocLabelById, MOCK_BRAIN_MAPS, MOCK_ONVOC_TERMS, MOCK_ONVOC_TREE } from 'pages/Explore/Explore.mockData';
import ExploreResultCard from 'pages/Explore/components/ExploreResultCard';
import OnvocTreeFilter from 'pages/Explore/components/OnvocTreeFilter';

const ExplorePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryFromUrl = searchParams.get('q') ?? '';
    const focusOnvoc = searchParams.get('focus') === 'onvoc';
    const onvocSectionRef = useRef<HTMLDivElement | null>(null);

    const [searchInput, setSearchInput] = useState(queryFromUrl);
    const [activeQuery, setActiveQuery] = useState(queryFromUrl);
    const [selectedLeafIds, setSelectedLeafIds] = useState<string[]>([]);
    const [modalityFilter, setModalityFilter] = useState('all');
    const [mapTypeFilter, setMapTypeFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [showUserResults, setShowUserResults] = useState(true);
    const [showLegacyNeurosynthResults, setShowLegacyNeurosynthResults] = useState(true);

    usePageMetadata({
        title: 'Explore Brain Maps | Neurosynth Compose',
        description: 'Browse and filter neuroimaging brain maps using ONVOC vocabulary terms.',
        canonicalPath: '/explore',
    });

    useEffect(() => {
        setSearchInput(queryFromUrl);
        setActiveQuery(queryFromUrl);
    }, [queryFromUrl]);

    useEffect(() => {
        if (focusOnvoc && onvocSectionRef.current) {
            onvocSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [focusOnvoc]);

    const selectedOnvocLabels = useMemo(
        () =>
            selectedLeafIds
                .map((leafId) => getOnvocLabelById(MOCK_ONVOC_TREE, leafId))
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
                selectedOnvocLabels.some((label) => brainMap.onvocTerms.includes(label));

            const matchesModality = modalityFilter === 'all' || brainMap.modality === modalityFilter;
            const matchesMapType = mapTypeFilter === 'all' || brainMap.mapType === mapTypeFilter;
            const matchesYear = yearFilter === 'all' || String(brainMap.year) === yearFilter;

            const matchesSource =
                (showUserResults && brainMap.source === 'user') ||
                (showLegacyNeurosynthResults && brainMap.source === 'legacy');

            return matchesQuery && matchesOnvoc && matchesModality && matchesMapType && matchesYear && matchesSource;
        });
    }, [
        activeQuery,
        selectedOnvocLabels,
        modalityFilter,
        mapTypeFilter,
        yearFilter,
        showUserResults,
        showLegacyNeurosynthResults,
    ]);

    const applySearchQuery = (query: string) => {
        const trimmedQuery = query.trim();
        setActiveQuery(trimmedQuery);
        const nextParams = new URLSearchParams(searchParams);
        if (trimmedQuery) {
            nextParams.set('q', trimmedQuery);
        } else {
            nextParams.delete('q');
        }
        setSearchParams(nextParams, { replace: true });
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        applySearchQuery(searchInput);
    };

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
                    width: { xs: '100%', md: 280 },
                    flexShrink: 0,
                    position: { md: 'sticky' },
                    top: { md: 80 },
                    maxHeight: { md: 'calc(100vh - 96px)' },
                    overflow: { md: 'auto' },
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Filters
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="explore-modality-label">Meta Analysis Type</InputLabel>
                    <Select
                        labelId="explore-modality-label"
                        label="Modality"
                        value={modalityFilter}
                        onChange={(event) => setModalityFilter(event.target.value)}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="fMRI">IBMA</MenuItem>
                        <MenuItem value="PET">CBMA</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="explore-map-type-label">Modality</InputLabel>
                    <Select
                        labelId="explore-map-type-label"
                        label="Map type"
                        value={mapTypeFilter}
                        onChange={(event) => setMapTypeFilter(event.target.value)}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="fMRI">fMRI</MenuItem>
                        <MenuItem value="PET">PET</MenuItem>
                    </Select>
                </FormControl>
                <Box ref={onvocSectionRef} sx={{ mb: 2 }}>
                    <OnvocTreeFilter
                        nodes={MOCK_ONVOC_TREE}
                        selectedLeafIds={selectedLeafIds}
                        onSelectedLeafIdsChange={setSelectedLeafIds}
                        emphasize={focusOnvoc}
                    />
                </Box>
                <FormGroup>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showUserResults}
                                onChange={(_event, checked) => setShowUserResults(checked)}
                                size="small"
                            />
                        }
                        label="Show results from users"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showLegacyNeurosynthResults}
                                onChange={(_event, checked) => setShowLegacyNeurosynthResults(checked)}
                                size="small"
                            />
                        }
                        label="Show legacy neurosynth results"
                    />
                </FormGroup>
            </Box>

            <Box component="main" sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Explore Meta-Analyses
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {filteredMaps.length} result{filteredMaps.length === 1 ? '' : 's'}
                    {activeQuery ? ` for “${activeQuery}”` : ''}
                    {selectedOnvocLabels.length > 0 ? ` · ONVOC: ${selectedOnvocLabels.join(', ')}` : ''}
                </Typography>

                <Box component="form" onSubmit={handleSearchSubmit} sx={{ mb: 3 }}>
                    <Autocomplete
                        freeSolo
                        fullWidth
                        options={MOCK_ONVOC_TERMS}
                        inputValue={searchInput}
                        onInputChange={(_event, value) => setSearchInput(value)}
                        onChange={(_event, value) => {
                            const selectedTerm = typeof value === 'string' ? value : (value ?? '');
                            setSearchInput(selectedTerm);
                            applySearchQuery(selectedTerm);
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

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {filteredMaps.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                            No brain maps match the current filters. Try clearing ONVOC terms or broadening your search.
                        </Typography>
                    ) : (
                        filteredMaps.map((brainMap) => <ExploreResultCard key={brainMap.id} brainMap={brainMap} />)
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default ExplorePage;
