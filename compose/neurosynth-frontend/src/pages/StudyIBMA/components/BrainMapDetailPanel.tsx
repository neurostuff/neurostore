import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Paper, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import useGetNeurovaultImages, { type INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React, { useMemo } from 'react';
import { STUDY_ANALYSIS_TABLE_MAX_HEIGHT } from './editStudyAnalysisBoard.constants';

function flattenMetadata(metadata: object | null | undefined): { key: string; value: string }[] {
    if (!metadata || typeof metadata !== 'object') return [];
    return Object.entries(metadata).map(([key, value]) => ({
        key,
        value: value === null || value === undefined ? '' : String(value),
    }));
}

function neurovaultApiUrlFromImageUrl(url: string | null | undefined): string | null {
    if (!url || !url.includes('neurovault.org')) return null;
    try {
        const u = new URL(url.replace(/^http:/, 'https:'));
        if (!u.hostname.includes('neurovault.org')) return null;
        if (u.pathname.includes('/api/')) return u.toString();
        const match = u.pathname.match(/\/images\/(\d+)/);
        if (match) return `https://neurovault.org/api/images/${match[1]}/`;
        return null;
    } catch {
        return null;
    }
}

function neurovaultRows(nv: INeurovault | undefined): { key: string; value: string }[] {
    if (!nv) return [];
    const entries: [string, unknown][] = [
        ['id', nv.id],
        ['name', nv.name],
        ['map_type', nv.map_type],
        ['image_type', nv.image_type],
        ['modality', nv.modality],
        ['analysis_level', nv.analysis_level],
        ['cognitive_paradigm_cogatlas', nv.cognitive_paradigm_cogatlas],
        ['number_of_subjects', nv.number_of_subjects],
        ['brain_coverage', nv.brain_coverage],
        ['perc_bad_voxels', nv.perc_bad_voxels],
        ['is_thresholded', nv.is_thresholded],
        ['file', nv.file],
        ['url', nv.url],
    ];
    return entries
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([key, value]) => ({ key, value: String(value) }));
}

export function BrainMapDetailPanel({ image, onClose }: { image: ImageReturn; onClose: () => void }) {
    const displayName = (image.filename || image.url || 'Image').trim() || 'Image';
    const storeMetaRows = useMemo(() => flattenMetadata(image.metadata ?? undefined), [image.metadata]);

    const nvUrl = useMemo(() => neurovaultApiUrlFromImageUrl(image.url), [image.url]);
    const { data: nvList, isLoading: nvLoading } = useGetNeurovaultImages(nvUrl ? [nvUrl] : []);
    const nv = nvList && nvList.length > 0 ? nvList[0] : undefined;
    const nvRows = useMemo(() => neurovaultRows(nv), [nv]);

    return (
        <Paper
            elevation={0}
            data-testid="brain-map-detail-panel"
            sx={{
                width: { xs: 'min(100%, 360px)', md: 360 },
                minWidth: { md: 300 },
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: STUDY_ANALYSIS_TABLE_MAX_HEIGHT,
                overflow: 'auto',
                bgcolor: 'background.paper',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight="bold" noWrap title={displayName}>
                    {displayName}
                </Typography>
                <Tooltip title="Close panel">
                    <IconButton size="small" onClick={onClose} aria-label="Close map details panel">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Image (Neurostore)
                </Typography>
                <Table size="small" sx={{ width: '100%' }}>
                    <TableBody>
                        {[
                            { key: 'filename', value: image.filename },
                            { key: 'value_type', value: image.value_type },
                            { key: 'space', value: image.space },
                            { key: 'url', value: image.url },
                        ]
                            .filter((r) => r.value)
                            .map((row) => (
                                <TableRow key={row.key}>
                                    <TableCell sx={{ p: '8px', verticalAlign: 'top', width: '36%' }}>
                                        <Typography variant="body2" fontWeight="bold">
                                            {row.key}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                            {row.value}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </Box>

            {storeMetaRows.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
                        Image metadata (Neurostore)
                    </Typography>
                    <Table size="small" sx={{ width: '100%' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ p: '8px', width: '36%' }}>
                                    <Typography variant="body2" fontWeight="bold">
                                        Field
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ p: '8px' }}>
                                    <Typography variant="body2" fontWeight="bold">
                                        Value
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {storeMetaRows.map((row) => (
                                <TableRow key={row.key}>
                                    <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                            {row.key}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                            {row.value}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            )}

            {nvUrl && (
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
                        NeuroVault details
                    </Typography>
                    {nvLoading && (
                        <Typography variant="body2" color="text.secondary">
                            Loading NeuroVault metadata…
                        </Typography>
                    )}
                    {!nvLoading && nvRows.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            No extra NeuroVault fields were returned for this URL.
                        </Typography>
                    )}
                    {nvRows.length > 0 && (
                        <Table size="small" sx={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ p: '8px', width: '36%' }}>
                                        <Typography variant="body2" fontWeight="bold">
                                            Field
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ p: '8px' }}>
                                        <Typography variant="body2" fontWeight="bold">
                                            Value
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {nvRows.map((row) => (
                                    <TableRow key={row.key}>
                                        <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                                {row.key}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                                {row.value}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Box>
            )}
        </Paper>
    );
}
