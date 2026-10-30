import { Button, Grid, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { Collection } from '../types';

const FIELDS: { key: keyof Collection; label: string; multiline?: boolean }[] = [
    { key: 'name', label: 'Collection name' },
    { key: 'DOI', label: 'DOI' },
    { key: 'authors', label: 'Authors' },
    { key: 'journal_name', label: 'Journal' },
    { key: 'paper_url', label: 'Paper URL' },
    { key: 'full_dataset_url', label: 'Dataset URL' },
    { key: 'description', label: 'Description', multiline: true },
];

/** The NeuroVault collection fields we propose for the paper. */
export function CollectionEditor({
    collection,
    disabled,
    saving,
    onSave,
}: {
    collection: Collection;
    disabled: boolean;
    saving: boolean;
    onSave: (collection: Collection) => void;
}) {
    const [edited, setEdited] = useState(collection);
    const dirty = FIELDS.some(({ key }) => (edited[key] ?? '') !== (collection[key] ?? ''));
    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                    NeuroVault collection
                </Typography>
                <Button size="small" disabled={!dirty || saving} onClick={() => setEdited(collection)}>
                    Undo changes
                </Button>
                <Button size="small" variant="contained" disabled={disabled || !dirty || saving} onClick={() => onSave(edited)}>
                    Save fields
                </Button>
            </Stack>
            <Grid container spacing={1.5}>
                {FIELDS.map(({ key, label, multiline }) => (
                    <Grid item xs={12} md={multiline ? 12 : 6} key={key}>
                        <TextField
                            fullWidth
                            size="small"
                            label={label}
                            value={edited[key] ?? ''}
                            disabled={disabled}
                            multiline={multiline}
                            minRows={multiline ? 2 : undefined}
                            onChange={(event) => setEdited((current) => ({ ...current, [key]: event.target.value }))}
                        />
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
}
