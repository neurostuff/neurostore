import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Grid,
    IconButton,
    Link,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { paperLinks } from '../links';
import type { ShareApi } from './api';
import { formatBytes, FITS, prompts, refusal, usableFiles } from './review';
import { HelpDialog, IssueDialog, ReplyDialog } from './ShareDialogs';
import { ISSUE_REASONS, type IssueReason, type ShareUpload, type ShareView } from './types';

const NOT_STARTED = ['draft', 'checked', 'contacted'];
const COLLECTION_FIELDS: [string, string][] = [
    ['name', 'Collection name'],
    ['authors', 'Authors'],
    ['description', 'Description'],
    ['full_dataset_url', 'Dataset URL'],
];

interface Queued {
    name: string;
    error: string | null;
}

function Section({ step, title, children }: { step?: number; title: string; children: ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                {step !== undefined && `${step}. `}
                {title}
            </Typography>
            {children}
        </Paper>
    );
}

function FileRow({
    upload,
    view,
    disabled,
    onAssign,
    onLabel,
    onRemove,
}: {
    upload: ShareUpload;
    view: ShareView;
    disabled: boolean;
    onAssign: (keys: string[]) => void;
    onLabel: (label: string) => void;
    onRemove: () => void;
}) {
    const [label, setLabel] = useState(upload.label ?? '');
    const notes = prompts(view).filter((prompt) => prompt.uploadId === upload.id);
    return (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                        {upload.filename}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                            {formatBytes(upload.size_bytes)}
                        </Typography>
                    </Typography>
                    <IconButton size="small" aria-label={`remove ${upload.filename}`} disabled={disabled} onClick={onRemove}>
                        ✕
                    </IconButton>
                </Stack>
                {upload.check_status === 'ok' && (
                    <TextField
                        select
                        size="small"
                        label="This map is for"
                        disabled={disabled}
                        SelectProps={{
                            multiple: true,
                            renderValue: (keys) =>
                                (keys as string[]).length === 0
                                    ? 'None of these analyses'
                                    : (keys as string[])
                                          .map((key) => view.analyses.find((a) => a.key === key)?.name)
                                          .join(', '),
                            displayEmpty: true,
                        }}
                        InputLabelProps={{ shrink: true }}
                        value={upload.analysis_keys}
                        onChange={(event) => onAssign(event.target.value as unknown as string[])}
                    >
                        {view.analyses.map((analysis) => {
                            const fit = upload.fits[analysis.key];
                            return (
                                <MenuItem key={analysis.key} value={analysis.key}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                        <span style={{ flexGrow: 1 }}>{analysis.name}</span>
                                        {fit && (
                                            <Chip size="small" color={FITS[fit.outcome].tone} variant="outlined" label={FITS[fit.outcome].label} />
                                        )}
                                    </Stack>
                                </MenuItem>
                            );
                        })}
                    </TextField>
                )}
                {upload.check_status === 'ok' && upload.analysis_keys.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {upload.analysis_keys.map((key) => {
                            const fit = upload.fits[key];
                            const name = view.analyses.find((a) => a.key === key)?.name;
                            return (
                                <Chip
                                    key={key}
                                    size="small"
                                    color={fit ? FITS[fit.outcome].tone : 'default'}
                                    label={`${name}: ${fit ? FITS[fit.outcome].label : 'not checked'}${
                                        upload.assigned_by === 'suggestion' ? ' (suggested)' : ''
                                    }`}
                                />
                            );
                        })}
                    </Stack>
                )}
                {upload.check_status === 'ok' && upload.analysis_keys.length === 0 && (
                    <TextField
                        size="small"
                        label="What is this map? (for maps the paper does not table)"
                        value={label}
                        disabled={disabled}
                        onChange={(event) => setLabel(event.target.value)}
                        onBlur={() => label !== (upload.label ?? '') && onLabel(label)}
                    />
                )}
                {notes.map((note) => (
                    <Alert key={note.text} severity={note.tone} sx={{ py: 0 }}>
                        {note.text}
                    </Alert>
                ))}
            </Stack>
        </Paper>
    );
}

export function SharePage({ api, initial }: { api: ShareApi; initial: ShareView }) {
    const [view, setView] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [queue, setQueue] = useState<Queued[]>([]);
    const [dialog, setDialog] = useState<'help' | 'reply' | { issue: string | null } | null>(null);
    const [details, setDetails] = useState(view.collection);
    const [name, setName] = useState(view.submitter_name ?? '');
    const [orcid, setOrcid] = useState(view.submitter_orcid ?? '');
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const started = !NOT_STARTED.includes(view.status);
    const editable = view.open && !view.preview;
    const submitted = ['submitted', 'approved', 'published'].includes(view.status);

    async function run(call: () => Promise<ShareView>) {
        setError(null);
        setBusy(true);
        try {
            setView(await call());
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
            setBusy(false);
        }
    }

    async function send(files: File[]) {
        const accepted: File[] = [];
        const refused: Queued[] = [];
        for (const file of files) {
            const reason = refusal(file, view, accepted.length);
            if (reason) refused.push({ name: file.name, error: reason });
            else accepted.push(file);
        }
        setQueue([...refused, ...accepted.map((file) => ({ name: file.name, error: null }))]);
        for (const file of accepted) {
            try {
                setView(await api.upload(file));
                setQueue((current) => current.filter((item) => item.name !== file.name || item.error));
            } catch (failure) {
                const message = failure instanceof Error ? failure.message : String(failure);
                setQueue((current) =>
                    current.map((item) => (item.name === file.name && !item.error ? { ...item, error: message } : item))
                );
            }
        }
    }

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        if (editable) void send(Array.from(event.dataTransfer.files));
    };
    const uploading = queue.some((item) => !item.error);
    const unassigned = view.analyses.filter((a) => !view.uploads.some((u) => u.analysis_keys.includes(a.key)));
    const { paper } = view;

    return (
        <Stack spacing={3}>
            <Stack spacing={0.5}>
                <Typography variant="h4" component="h1">
                    Share the maps from your paper
                </Typography>
                <Typography variant="subtitle1">{paper.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {[paper.journal, paper.year].filter(Boolean).join(', ')}
                    {paperLinks(paper).map((link) => (
                        <Link key={link.label} href={link.href} target="_blank" rel="noreferrer" sx={{ ml: 1.5 }}>
                            {link.label}
                        </Link>
                    ))}
                </Typography>
            </Stack>

            {view.preview && (
                <Alert severity="info">Preview: this is the author's page. Nothing you do here is recorded or kept.</Alert>
            )}
            {!view.open && !submitted && <Alert severity="info">{view.closed_reason}</Alert>}
            {submitted && (
                <Alert severity="success">
                    Thank you. We have your maps and will check them before they are published on NeuroVault. We will email
                    you when your collection is live.
                </Alert>
            )}
            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {editable && !started && (
                <Section title="What we are asking">
                    <Typography paragraph>
                        We would like to add this paper's group-level, unthresholded statistical maps to{' '}
                        <Link href="https://neurovault.org" target="_blank" rel="noreferrer">
                            NeuroVault
                        </Link>
                        , so others can reuse them. Our software read the paper and found the {view.analyses.length}{' '}
                        {view.analyses.length === 1 ? 'analysis' : 'analyses'} below. Drop in your maps, check that each
                        landed on the right analysis, and submit. It takes a few minutes and needs no account.
                    </Typography>
                    <Button variant="contained" disabled={busy} onClick={() => void run(api.opened)}>
                        Get started
                    </Button>
                </Section>
            )}

            {(started || view.preview) && !submitted && (
                <>
                    <Section step={1} title="Drop your maps">
                        <Box
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={onDrop}
                            sx={{
                                border: '2px dashed',
                                borderColor: 'divider',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                bgcolor: 'action.hover',
                            }}
                        >
                            <Typography gutterBottom>
                                Drag all your .nii or .nii.gz files here at once, or
                            </Typography>
                            <Button variant="outlined" disabled={!editable || uploading} onClick={() => input.current?.click()}>
                                Choose files
                            </Button>
                            <input
                                ref={input}
                                hidden
                                type="file"
                                multiple
                                accept=".nii,.nii.gz,.gz"
                                onChange={(event) => {
                                    void send(Array.from(event.target.files ?? []));
                                    event.target.value = '';
                                }}
                            />
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                                Up to {view.limits.max_files} files, 200 MB each. Unthresholded group maps (t, z or effect
                                size) are most useful.
                            </Typography>
                        </Box>
                        {queue.map((item) => (
                            <Alert key={item.name} severity={item.error ? 'error' : 'info'} sx={{ mt: 1 }}>
                                {item.name}: {item.error ?? 'uploading and checking…'}
                            </Alert>
                        ))}
                    </Section>

                    <Section step={2} title="Check which map goes with which analysis">
                        <Typography variant="body2" color="text.secondary" paragraph>
                            We compared each map with the coordinates the paper reports and suggested a match. Change any
                            that are wrong. If an analysis below is wrong or missing, tell us; you don't need to fix it.
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={7}>
                                <Stack spacing={1.5}>
                                    {view.uploads.length === 0 && (
                                        <Typography variant="body2">No files yet.</Typography>
                                    )}
                                    {view.uploads.map((upload) => (
                                        <FileRow
                                            key={`${upload.id}-${upload.label ?? ''}`}
                                            upload={upload}
                                            view={view}
                                            disabled={!editable || busy}
                                            onAssign={(keys) => void run(() => api.assign(upload.id, { analysis_keys: keys }))}
                                            onLabel={(label) => void run(() => api.assign(upload.id, { label }))}
                                            onRemove={() => void run(() => api.remove(upload.id))}
                                        />
                                    ))}
                                </Stack>
                            </Grid>
                            <Grid item xs={12} md={5}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Analyses we found
                                </Typography>
                                <Stack spacing={1}>
                                    {view.analyses.map((analysis) => (
                                        <Box key={analysis.key}>
                                            <Typography variant="body2">
                                                {analysis.name}
                                                {unassigned.includes(analysis) && (
                                                    <Chip size="small" label="no file" sx={{ ml: 1 }} />
                                                )}
                                            </Typography>
                                            {view.issues
                                                .filter((issue) => issue.analysis_key === analysis.key)
                                                .map((issue, index) => (
                                                    <Typography key={index} variant="caption" color="warning.main" display="block">
                                                        You told us: {ISSUE_REASONS[issue.reason as IssueReason] ?? issue.reason}
                                                    </Typography>
                                                ))}
                                            <Typography variant="caption" color="text.secondary">
                                                {analysis.points} coordinates ·{' '}
                                                <Link
                                                    component="button"
                                                    variant="caption"
                                                    disabled={view.preview}
                                                    onClick={() => setDialog({ issue: analysis.key })}
                                                >
                                                    something's wrong with this one
                                                </Link>
                                            </Typography>
                                        </Box>
                                    ))}
                                    {view.issues.some((issue) => issue.reason === 'missing_analysis') && (
                                        <Typography variant="caption" color="warning.main">
                                            You told us an analysis is missing. Thank you.
                                        </Typography>
                                    )}
                                    <Link
                                        component="button"
                                        variant="body2"
                                        sx={{ textAlign: 'left' }}
                                        disabled={view.preview}
                                        onClick={() => setDialog({ issue: null })}
                                    >
                                        An analysis is missing
                                    </Link>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Section>

                    <Accordion variant="outlined" disableGutters>
                        <AccordionSummary expandIcon={<span>▾</span>}>
                            <Typography variant="h6" component="h2">
                                3. Details for NeuroVault (optional)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={1.5}>
                                <Typography variant="body2" color="text.secondary">
                                    We filled these in from the paper. Change them only if something is clearly wrong.
                                </Typography>
                                {COLLECTION_FIELDS.map(([field, label]) => (
                                    <TextField
                                        key={field}
                                        size="small"
                                        label={label}
                                        value={details[field] ?? ''}
                                        disabled={!editable}
                                        multiline={field === 'description'}
                                        onChange={(event) => setDetails({ ...details, [field]: event.target.value })}
                                    />
                                ))}
                                <Box>
                                    <Button
                                        disabled={!editable || busy || JSON.stringify(details) === JSON.stringify(view.collection)}
                                        onClick={() => void run(() => api.metadata(details))}
                                    >
                                        Save details
                                    </Button>
                                </Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>

                    <Section step={4} title="Submit">
                        <Stack spacing={1.5}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    size="small"
                                    label="Your name"
                                    required
                                    value={name}
                                    disabled={!editable}
                                    onChange={(event) => setName(event.target.value)}
                                />
                                <TextField
                                    size="small"
                                    label="ORCID iD (optional)"
                                    placeholder="0000-0002-1825-0097"
                                    value={orcid}
                                    disabled={!editable}
                                    onChange={(event) => setOrcid(event.target.value)}
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                Submitting lets us publish these maps on NeuroVault, openly licensed as NeuroVault requires,
                                once we have checked them.
                            </Typography>
                            <Box>
                                <Button
                                    variant="contained"
                                    disabled={!editable || busy || uploading || !name.trim() || usableFiles(view).length === 0}
                                    onClick={() => void run(() => api.submit({ name, orcid: orcid || undefined }))}
                                >
                                    Submit {usableFiles(view).length} map{usableFiles(view).length === 1 ? '' : 's'}
                                </Button>
                            </Box>
                        </Stack>
                    </Section>
                </>
            )}

            {editable && !submitted && (
                <Stack direction="row" spacing={2}>
                    <Button onClick={() => setDialog('reply')}>Can't share these maps?</Button>
                    <Button onClick={() => setDialog('help')}>Need help?</Button>
                </Stack>
            )}

            <IssueDialog
                open={typeof dialog === 'object' && dialog !== null}
                analysis={
                    typeof dialog === 'object' && dialog?.issue
                        ? view.analyses.find((a) => a.key === dialog.issue) ?? null
                        : null
                }
                onClose={() => setDialog(null)}
                onSend={(issue) => run(() => api.issue(issue)).then(() => setDialog(null))}
            />
            <ReplyDialog
                open={dialog === 'reply'}
                onClose={() => setDialog(null)}
                onSend={(reply) => run(() => api.reply(reply)).then(() => setDialog(null))}
            />
            <HelpDialog
                open={dialog === 'help'}
                onClose={() => setDialog(null)}
                onSend={(note) => run(() => api.issue({ kind: 'help', note })).then(() => setDialog(null))}
            />
        </Stack>
    );
}
