import CloseIcon from '@mui/icons-material/Close';
import {
    IconButton,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import useGetNeurovaultImages, { type INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { useMemo, useState } from 'react';
import { STUDY_ANALYSIS_TABLE_MAX_HEIGHT } from '../hooks/useEditStudyAnalysisBoardState.consts';

export type KeyValueRow = { key: string; value: string };

export const filterKeyValueRowsByFieldQuery = (rows: KeyValueRow[], query: string): KeyValueRow[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;
    return rows.filter((row) => row.key.toLowerCase().includes(normalizedQuery));
};

function normalizeMetadataToArray(metadata: object | null | undefined): KeyValueRow[] {
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

function KeyValueTable({
    title,
    rows,
    showColumnHeader = false,
}: {
    title: string;
    rows: KeyValueRow[];
    showColumnHeader?: boolean;
}) {
    const [fieldFilterQuery, setFieldFilterQuery] = useState('');
    const filteredRows = useMemo(
        () => filterKeyValueRowsByFieldQuery(rows, fieldFilterQuery),
        [rows, fieldFilterQuery]
    );
    const hasActiveFilter = fieldFilterQuery.trim().length > 0;

    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2" fontWeight="bold">
                {title}
            </Typography>
            <TextField
                size="small"
                fullWidth
                placeholder="Filter fields"
                value={fieldFilterQuery}
                onChange={(event) => setFieldFilterQuery(event.target.value)}
                inputProps={{ 'aria-label': 'Filter table fields', 'data-testid': 'key-value-table-field-filter' }}
            />
            {hasActiveFilter && filteredRows.length === 0 ? (
                <Typography variant="body2" color="warning.dark">
                    No fields match your filter.
                </Typography>
            ) : (
                <Table size="small">
                    {showColumnHeader && (
                        <TableHead>
                            <TableRow>
                                <TableCell width="36%">Field</TableCell>
                                <TableCell>Value</TableCell>
                            </TableRow>
                        </TableHead>
                    )}
                    <TableBody>
                        {filteredRows.map((row) => (
                            <TableRow key={row.key}>
                                <TableCell width="36%">
                                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                        {row.key}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                        {row.value}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Stack>
    );
}

const BrainMapDetailPanel: React.FC<{
    image: ImageReturn;
    onClose: () => void;
}> = ({ image, onClose }) => {
    const displayName = (image.filename || image.url || 'Image').trim() || 'Image';
    const storeMetaRows = useMemo(() => normalizeMetadataToArray(image.metadata ?? undefined), [image.metadata]);

    const nvUrl = useMemo(() => neurovaultApiUrlFromImageUrl(image.url), [image.url]);
    const { data: nvList, isLoading: nvLoading } = useGetNeurovaultImages(nvUrl ? [nvUrl] : []);
    const nv = nvList && nvList.length > 0 ? nvList[0] : undefined;
    const nvRows = useMemo(() => normalizeMetadataToArray(nv ?? undefined), [nv]);

    const imageRows = useMemo(
        () =>
            [
                { key: 'filename', value: image.filename },
                { key: 'value_type', value: image.value_type },
                { key: 'space', value: image.space },
                { key: 'url', value: image.url },
            ]
                .filter((row): row is KeyValueRow => Boolean(row.value))
                .map((row) => ({ key: row.key, value: String(row.value) })),
        [image.filename, image.value_type, image.space, image.url]
    );

    if (nvLoading) {
        return (
            <Paper sx={{ flex: '1 1 0', minWidth: 250 }}>
                <Skeleton
                    sx={{
                        width: '100%',
                        height: '100%',
                        transformOrigin: '0 0',
                        transform: 'none',
                    }}
                />
            </Paper>
        );
    }

    return (
        <Paper
            variant="elevation"
            elevation={2}
            data-testid="brain-map-detail-panel"
            sx={{
                flex: '1 1 0',
                minWidth: 250,
                maxHeight: STUDY_ANALYSIS_TABLE_MAX_HEIGHT,
                overflow: 'auto',
                p: 2,
            }}
        >
            <Stack spacing={2}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} minWidth={0}>
                    <Typography variant="subtitle1" fontWeight="bold" title={displayName}>
                        {displayName}
                    </Typography>
                    <Tooltip title="Close panel">
                        <IconButton size="small" onClick={onClose} aria-label="Close map details panel">
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <KeyValueTable title="Image (Neurostore)" rows={imageRows} />

                {storeMetaRows.length > 0 && (
                    <KeyValueTable title="Image metadata (Neurostore)" rows={storeMetaRows} showColumnHeader />
                )}

                {nvUrl && nvRows.length === 0 && (
                    <Stack spacing={1}>
                        <Typography variant="subtitle2" fontWeight="bold">
                            NeuroVault details
                        </Typography>
                        <Typography variant="body2" color="warning.dark">
                            No extra NeuroVault fields were returned for this URL.
                        </Typography>
                    </Stack>
                )}
                {nvUrl && nvRows.length > 0 && (
                    <KeyValueTable title="NeuroVault details" rows={nvRows} showColumnHeader />
                )}
            </Stack>
        </Paper>
    );
};

export default BrainMapDetailPanel;
