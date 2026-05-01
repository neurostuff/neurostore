import { ArrowDownward } from '@mui/icons-material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import { alpha, Box, Button, Chip, Paper, Typography, useTheme } from '@mui/material';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import { retrieveExtractionTableState } from 'pages/Extraction/components/ExtractionTable.helpers';
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { useStudyId } from 'stores/study/StudyStore';

/** Column `id`s from `ExtractionTable` — keep in sync with extraction column definitions. */
const EXTRACTION_COLUMN_FILTER_LABELS: Record<string, string> = {
    year: 'Year',
    name: 'Name',
    authors: 'Authors',
    journal: 'Journal',
    pmid: 'PMID',
    status: 'Status',
};

const ExtractionStudiesPreviewer: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const projectId = useProjectId();
    const studyId = useStudyId();
    const studysetId = useProjectExtractionStudysetId();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);
    const selectedCardRef = useRef<HTMLButtonElement | null>(null);
    const extractionTableState = retrieveExtractionTableState(projectId);

    const { data, isLoading } = useGetStudysetById(studysetId || '', false, true);

    const studyMap = useMemo(() => {
        const map = new Map<string, StudyReturn>();
        if (!data?.studies) return map;
        for (const aStudy of data.studies) {
            if (typeof aStudy === 'string') continue;
            const study = aStudy as StudyReturn;
            if (study.id) map.set(study.id, study);
        }
        return map;
    }, [data?.studies]);

    const studyToStatusMap = useMemo(() => {
        const m = new Map<string, EExtractionStatus>();
        studyStatusList?.forEach((row) => {
            m.set(row.id, row.status);
        });
        return m;
    }, [studyStatusList]);

    const studyRows = useMemo(() => {
        if (!extractionTableState?.studies) return [];
        return extractionTableState.studies.map((id) => {
            const study = studyMap.get(id);
            const status = studyToStatusMap.get(id) ?? EExtractionStatus.UNCATEGORIZED;
            return {
                id,
                title: study?.name?.trim() || id,
                analysisCount: study?.analyses?.length ?? 0,
                status,
            };
        });
    }, [extractionTableState?.studies, studyMap, studyToStatusMap]);

    const navigateToStudy = useCallback(
        (targetStudyId: string) => {
            if (!studyId || targetStudyId === studyId) return;
            if (canEdit) {
                navigate(`/projects/${projectId}/extraction/studies/${targetStudyId}/edit`);
            } else {
                navigate(`/projects/${projectId}/extraction/studies/${targetStudyId}`);
            }
        },
        [canEdit, navigate, projectId, studyId]
    );

    const currentIndex = useMemo(() => studyRows.findIndex((r) => r.id === studyId), [studyRows, studyId]);

    const handlePrev = () => {
        if (currentIndex <= 0) return;
        navigateToStudy(studyRows[currentIndex - 1]?.id);
    };

    const handleNext = () => {
        if (currentIndex < 0 || currentIndex >= studyRows.length - 1) return;
        navigateToStudy(studyRows[currentIndex + 1]?.id);
    };

    useLayoutEffect(() => {
        const el = selectedCardRef.current;
        if (!studyId || !el || typeof el.scrollIntoView !== 'function') return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [studyId, studyRows.length]);

    const activeColumnFilters = useMemo(() => {
        if (!extractionTableState?.columnFilters) return [];
        return extractionTableState?.columnFilters.filter((f) => !!f.value);
    }, [extractionTableState?.columnFilters]);

    const activeSorting = useMemo(() => {
        if (!extractionTableState?.sorting) return [];
        return extractionTableState?.sorting.filter((s) => !!s.id);
    }, [extractionTableState?.sorting]);

    const isFiltered = activeColumnFilters.length > 0;
    const isSorted = activeSorting.length > 0;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < studyRows.length - 1;

    const getStatusColors = (status: EExtractionStatus) => {
        switch (status) {
            case EExtractionStatus.COMPLETED:
                return {
                    bg: alpha(theme.palette.success.main, 0.14),
                    border: alpha(theme.palette.success.dark, 0.35),
                    accent: theme.palette.success.dark,
                };
            case EExtractionStatus.SAVEDFORLATER:
                return {
                    bg: alpha(theme.palette.info.main, 0.12),
                    border: alpha(theme.palette.info.dark, 0.35),
                    accent: theme.palette.info.dark,
                };
            case EExtractionStatus.UNCATEGORIZED:
            default:
                return {
                    bg: alpha(theme.palette.warning.main, 0.16),
                    border: alpha(theme.palette.warning.dark, 0.4),
                    accent: theme.palette.warning.dark,
                };
        }
    };

    const statusLabel = (status: EExtractionStatus) => {
        switch (status) {
            case EExtractionStatus.COMPLETED:
                return 'Complete';
            case EExtractionStatus.SAVEDFORLATER:
                return 'Saved for later';
            default:
                return 'Unreviewed';
        }
    };

    if (!projectId || !studysetId) return null;

    return (
        <Paper
            data-testid="extraction-studies-previewer"
            sx={{
                width: '350px',
                display: 'flex',
                minHeight: 0,
                flexDirection: 'column',
                height: '100%',
            }}
        >
            <Box sx={{ px: 2, py: 1, flex: '0 0 auto' }}>
                {isFiltered && (
                    <>
                        <Typography gutterBottom variant="body2">
                            Active filters
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {activeColumnFilters.map((filter) => {
                                const columnTitle = EXTRACTION_COLUMN_FILTER_LABELS[filter.id] ?? filter.id;

                                return (
                                    <Chip
                                        key={filter.id}
                                        size="small"
                                        icon={<FilterListIcon sx={{ fontSize: '1rem' }} />}
                                        label={`${columnTitle}: ${filter.value}`}
                                        sx={{ p: 0.5 }}
                                        color="info"
                                        variant="outlined"
                                    />
                                );
                            })}
                        </Box>
                    </>
                )}
                {isSorted && (
                    <>
                        <Typography gutterBottom variant="body2" sx={{ mt: 1 }}>
                            Sorting by
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {activeSorting.map((sort) => {
                                return (
                                    <Chip
                                        key={sort.id}
                                        size="small"
                                        icon={<ArrowDownward sx={{ fontSize: '1rem' }} />}
                                        label={`${sort.id}: ${sort.desc ? 'desc' : 'asc'}`}
                                        color="secondary"
                                        sx={{ p: 0.5 }}
                                        variant="outlined"
                                    />
                                );
                            })}
                        </Box>
                    </>
                )}
            </Box>

            <Box sx={{ px: 2, pb: 1, flex: '0 0 auto' }}>
                <Button
                    data-testid="extraction-previewer-prev"
                    fullWidth
                    variant="outlined"
                    disableElevation
                    disabled={!hasPrev}
                    onClick={handlePrev}
                >
                    <ExpandLess />
                    PREVIOUS
                </Button>
            </Box>

            <Box
                className="sleek-scrollbar"
                sx={{
                    flex: '1 1 auto',
                    minHeight: 0,
                    overflowY: 'auto',
                    mx: 1.5,
                    px: 0.5,
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {studyRows.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2, textAlign: 'center' }}>
                            {isLoading ? 'Loading studies…' : 'No studies in this list yet.'}
                        </Typography>
                    ) : (
                        studyRows.map(({ id, title, analysisCount, status }) => {
                            const selected = id === studyId;
                            const statusColor = getStatusColors(status);
                            return (
                                <Button
                                    key={id}
                                    ref={selected ? selectedCardRef : undefined}
                                    data-testid={`extraction-previewer-study-${id}`}
                                    onClick={() => navigateToStudy(id)}
                                    disableElevation
                                    sx={{
                                        display: 'block',
                                        p: 0,
                                        textAlign: 'left',
                                        textTransform: 'none',
                                        bgcolor: statusColor.bg,
                                        border: '1px solid',
                                        borderColor: selected ? 'primary.main' : statusColor.border,
                                        '&:hover': {
                                            borderColor: selected ? 'primary.main' : statusColor.accent,
                                        },
                                    }}
                                >
                                    <Box sx={{ px: 1.5, py: 1.25 }}>
                                        <Typography
                                            variant="subtitle2"
                                            className="line-clamp-1"
                                            sx={{
                                                fontWeight: 'bold',
                                                lineHeight: 'normal',
                                                color: selected ? 'primary.main' : 'text.primary',
                                            }}
                                        >
                                            {title}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 1,
                                                mt: 0.75,
                                            }}
                                        >
                                            <Typography variant="caption" color="text.secondary">
                                                {analysisCount === 1 ? '1 analysis' : `${analysisCount} analyses`}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: statusColor.accent,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {statusLabel(status)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Button>
                            );
                        })
                    )}
                </Box>
            </Box>

            <Box sx={{ px: 2, pt: 1, pb: 2, flex: '0 0 auto' }}>
                <Button
                    data-testid="extraction-previewer-next"
                    color="primary"
                    disableElevation
                    variant="outlined"
                    fullWidth
                    disabled={!hasNext}
                    onClick={handleNext}
                >
                    <ExpandMore />
                    NEXT
                </Button>
            </Box>
        </Paper>
    );
};

export default ExtractionStudiesPreviewer;
