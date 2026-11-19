import { Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

/** The author's name and ORCID iD, and the Submit button. The two fields are typed into
 * here, not in SharePage, so a keystroke re-renders only this form and not the board and
 * file lists above it. */
export function SubmitForm({
    initialName,
    initialOrcid,
    disabled,
    busy,
    count,
    onSubmit,
}: {
    initialName: string;
    initialOrcid: string;
    /** The page cannot be edited (closed, or a preview). */
    disabled: boolean;
    /** A change or an upload is going through. */
    busy: boolean;
    /** How many maps would be sent. */
    count: number;
    onSubmit: (author: { name: string; orcid?: string; upload_unassigned: boolean }) => void;
}) {
    const [name, setName] = useState(initialName);
    const [orcid, setOrcid] = useState(initialOrcid);
    const [uploadUnassigned, setUploadUnassigned] = useState(true);
    return (
        <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                    fullWidth
                    size="small"
                    label="Your name"
                    required
                    value={name}
                    disabled={disabled}
                    onChange={(event) => setName(event.target.value)}
                />
                <TextField
                    fullWidth
                    size="small"
                    label="ORCID iD (optional)"
                    placeholder="0000-0002-1825-0097"
                    value={orcid}
                    disabled={disabled}
                    onChange={(event) => setOrcid(event.target.value)}
                />
            </Stack>
            <Typography variant="caption" color="text.secondary">
                Submitting lets us publish these maps on NeuroVault under its open licence.
            </Typography>
            <Box>
                <FormControlLabel
                    disabled={disabled}
                    control={
                        <Checkbox
                            checked={uploadUnassigned}
                            onChange={(event) => setUploadUnassigned(event.target.checked)}
                        />
                    }
                    label="Upload unassigned maps to neurovault collection"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: -0.5 }}>
                    Unchecking this option will discard maps that have not been assigned to an analysis. They will
                    not be uploaded to neurovault.
                </Typography>
            </Box>
            <Box>
                <Button
                    variant="contained"
                    disabled={disabled || busy || !name.trim() || count === 0}
                    onClick={() => onSubmit({ name, orcid: orcid || undefined, upload_unassigned: uploadUnassigned })}
                >
                    Submit {count} map{count === 1 ? '' : 's'}
                </Button>
            </Box>
        </>
    );
}
