import { ExpandLess, ExpandMore, Search } from '@mui/icons-material';
import {
    Collapse,
    Grid,
    InputAdornment,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import BrainMapDetailPanel from 'pages/StudyIBMA/components/BrainMapDetailPanel';
import {
    imageToBrainMapListItem,
    sortAnalysesByOrder,
    sortImages,
} from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import { useEffect, useMemo, useState } from 'react';
import { DefaultMapTypes, IStoreAnalysis } from 'stores/study/StudyStore.helpers';

type StudyAnalysesIBMAProps = {
    id: string | undefined;
    analyses: IStoreAnalysis[];
};

type AnalysisWithImages = {
    id: string;
    name: string;
    description: string;
    images: ImageReturn[];
};

const PANEL_HEIGHT = '80vh';

const imageRowSx = {
    ml: 2,
    mr: 1.5,
    mb: 0.5,
    bgcolor: 'grey.50',
    '&:hover': { bgcolor: 'grey.100' },
    '&.Mui-selected': {
        bgcolor: 'grey.200',
        '&:hover': { bgcolor: 'grey.300' },
    },
} as const;

const getImagesForAnalysis = (analysis: IStoreAnalysis): ImageReturn[] =>
    sortImages(((analysis.images ?? []) as ImageReturn[]).filter((image) => Boolean(image.id)));

const getOrderedImages = (analyses: IStoreAnalysis[]): ImageReturn[] =>
    sortAnalysesByOrder(analyses).flatMap(getImagesForAnalysis);

const imageMatchesQuery = (image: ImageReturn, normalizedQuery: string): boolean => {
    const listItem = imageToBrainMapListItem(image);
    const mapTypeLabel = DefaultMapTypes[listItem.mapType]?.label ?? listItem.mapType;
    const haystack = [listItem.name, image.filename, image.url, image.value_type, image.space, mapTypeLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(normalizedQuery);
};

const buildAnalysisGroups = (analyses: IStoreAnalysis[], searchQuery: string): AnalysisWithImages[] => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortAnalysesByOrder(analyses).flatMap((analysis) => {
        if (!analysis.id) return [];

        const sortedImages = getImagesForAnalysis(analysis);
        const name = analysis.name?.trim() || 'Untitled analysis';
        const description = analysis.description?.trim() || '';

        if (!normalizedQuery) {
            return [{ id: analysis.id, name, description, images: sortedImages }];
        }

        const analysisMatches =
            name.toLowerCase().includes(normalizedQuery) || description.toLowerCase().includes(normalizedQuery);
        const images = analysisMatches
            ? sortedImages
            : sortedImages.filter((image) => imageMatchesQuery(image, normalizedQuery));

        if (!analysisMatches && images.length === 0) return [];
        return [{ id: analysis.id, name, description, images }];
    });
};

const AnalysisGroupHeader = ({
    name,
    description,
    expanded,
    canToggle,
    onToggle,
}: {
    name: string;
    description: string;
    expanded: boolean;
    canToggle: boolean;
    onToggle: () => void;
}) => (
    <ListSubheader
        component="div"
        onClick={canToggle ? onToggle : undefined}
        sx={{
            py: 1,
            lineHeight: 'normal',
            bgcolor: 'background.paper',
            cursor: canToggle ? 'pointer' : 'default',
        }}
    >
        <Stack direction="row" alignItems="center">
            <ListItemText
                primary={name}
                secondary={description || undefined}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 700, noWrap: true }}
                secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                sx={{ my: 0, minWidth: 0, flex: 1 }}
            />
            {expanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
        </Stack>
    </ListSubheader>
);

const ImageRow = ({
    image,
    selected,
    onSelect,
}: {
    image: ImageReturn;
    selected: boolean;
    onSelect: (imageId: string) => void;
}) => {
    const listItem = imageToBrainMapListItem(image);
    const mapTypeLabel = DefaultMapTypes[listItem.mapType]?.label ?? listItem.mapType;
    const imageId = image.id!;

    return (
        <ListItemButton dense selected={selected} onClick={() => onSelect(imageId)} sx={imageRowSx}>
            <ListItemText
                primary={listItem.name}
                secondary={mapTypeLabel}
                primaryTypographyProps={{
                    variant: 'caption',
                    noWrap: true,
                    color: selected ? 'primary.main' : 'text.secondary',
                    fontWeight: selected ? 600 : undefined,
                }}
                secondaryTypographyProps={{ variant: 'caption', noWrap: true, color: 'text.disabled' }}
                sx={{ minWidth: 0 }}
            />
        </ListItemButton>
    );
};

const StudyAnalysesIBMA = ({ id, analyses }: StudyAnalysesIBMAProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [collapsedAnalysisIds, setCollapsedAnalysisIds] = useState<Set<string>>(() => new Set());

    const analysisGroups = useMemo(() => buildAnalysisGroups(analyses, searchQuery), [analyses, searchQuery]);
    const visibleImages = useMemo(() => analysisGroups.flatMap((group) => group.images), [analysisGroups]);
    const hasAnyImages = useMemo(() => getOrderedImages(analyses).length > 0, [analyses]);
    const isSearching = Boolean(searchQuery.trim());

    useEffect(() => {
        setCollapsedAnalysisIds(new Set());
        setSearchQuery('');
        setSelectedImageId(getOrderedImages(analyses)[0]?.id ?? null);
    }, [analyses, id]);

    useEffect(() => {
        if (!selectedImageId) return;
        if (!visibleImages.some((image) => image.id === selectedImageId)) {
            setSelectedImageId(visibleImages[0]?.id ?? null);
        }
    }, [visibleImages, selectedImageId]);

    const selectedImage = useMemo(
        () => visibleImages.find((image) => image.id === selectedImageId),
        [visibleImages, selectedImageId]
    );

    const handleToggleAnalysisExpanded = (analysisId: string) => {
        setCollapsedAnalysisIds((previous) => {
            const next = new Set(previous);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    };

    if (!hasAnyImages) {
        return <Typography color="warning.dark">There are no images for this study.</Typography>;
    }

    return (
        <Grid container spacing={2} height={PANEL_HEIGHT}>
            <Grid item xs={12} md={4} lg={3} height="100%" minHeight={0} display="flex">
                <Paper
                    variant="outlined"
                    sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                    <Stack spacing={1} p={1.5} flex={1} minHeight={0}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Search images"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            inputProps={{ 'aria-label': 'Search images', 'data-testid': 'study-analyses-ibma-search' }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <List
                            dense
                            disablePadding
                            data-testid="study-analyses-ibma-list"
                            sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
                        >
                            {analysisGroups.length === 0 ? (
                                <ListItemButton disabled>
                                    <ListItemText
                                        primary="No images match your search."
                                        primaryTypographyProps={{ variant: 'body2', color: 'warning.dark' }}
                                    />
                                </ListItemButton>
                            ) : (
                                analysisGroups.map((analysisGroup) => {
                                    const expanded = isSearching || !collapsedAnalysisIds.has(analysisGroup.id);
                                    const canToggle = !isSearching && analysisGroup.images.length > 0;

                                    return (
                                        <li key={analysisGroup.id}>
                                            <AnalysisGroupHeader
                                                name={analysisGroup.name}
                                                description={analysisGroup.description}
                                                expanded={expanded}
                                                canToggle={canToggle}
                                                onToggle={() => handleToggleAnalysisExpanded(analysisGroup.id)}
                                            />
                                            <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                <List dense disablePadding component="div">
                                                    {analysisGroup.images.map((image) => (
                                                        <ImageRow
                                                            key={image.id}
                                                            image={image}
                                                            selected={selectedImageId === image.id}
                                                            onSelect={setSelectedImageId}
                                                        />
                                                    ))}
                                                </List>
                                            </Collapse>
                                        </li>
                                    );
                                })
                            )}
                        </List>
                    </Stack>
                </Paper>
            </Grid>

            <Grid item xs={12} md={8} lg={9} height="100%" minHeight={0} display="flex">
                <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                    <Stack p={2}>
                        {selectedImage ? (
                            <BrainMapDetailPanel image={selectedImage} onClose={() => setSelectedImageId(null)} />
                        ) : (
                            <Typography color="text.secondary">Select an image to view details.</Typography>
                        )}
                    </Stack>
                </Paper>
            </Grid>
        </Grid>
    );
};

export default StudyAnalysesIBMA;
