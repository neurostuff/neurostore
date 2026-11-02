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
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { paperLinks } from '../links';
import type { ShareApi } from './api';
import { defaultSoftware, INSTRUCTIONS } from './instructions';
import {
    commonFolder,
    formatBytes,
    FITS,
    inFolder,
    ordered,
    prompts,
    refusal,
    TYPE_LABELS,
    usableFiles,
    type Tone,
} from './review';
import { HelpDialog, IssueDialog, ReplyDialog } from './ShareDialogs';
import { pickMaps, withPaths, type Candidate } from './tree';
import { TreePicker } from './TreePicker';
import { ISSUE_REASONS, MAP_TYPES, type IssueReason, type MapType, type ShareUpload, type ShareView } from './types';

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

/** A file's path inside the folder all the uploads share: enough to tell
 * cope1.feat/stats/zstat1 from cope2's, without repeating the folder on every row. */
const shownPath = (upload: ShareUpload, folder: string) => (upload.path ? inFolder(upload.path, folder) : upload.filename);

const PAIRED_BY: Record<string, string> = {
    name: 'by its name',
    'name+correlation': 'by its name and values',
    correlation: 'by its values',
    author: 'by you',
};

function FileRow({
    upload,
    view,
    folder,
    disabled,
    onChange,
    onRemove,
}: {
    upload: ShareUpload;
    view: ShareView;
    /** The folder every upload sits in, left off each row's path. */
    folder: string;
    disabled: boolean;
    onChange: (change: Parameters<ShareApi['assign']>[1]) => void;
    onRemove: () => void;
}) {
    const [label, setLabel] = useState(upload.label ?? '');
    const notes = prompts(view).filter((prompt) => prompt.uploadId === upload.id);
    const partner = view.uploads.find((other) => other.id === upload.partner_id);
    const member = upload.kind === 'effect' || upload.kind === 'variance';
    const statistics = view.uploads.filter((other) => other.kind === 'statistic' && other.check_status === 'ok');
    const names = (keys: string[]) => keys.map((key) => view.analyses.find((a) => a.key === key)?.name).join(', ');
    return (
        <Paper
            variant="outlined"
            // Stack resets its children's margins, so the indent of a set's maps is inline.
            style={partner ? { marginLeft: 24 } : undefined}
            sx={{ p: 1.5, ...(partner ? { borderLeft: 3, borderLeftColor: 'primary.light' } : {}) }}
        >
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
                        {shownPath(upload, folder)}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                            {formatBytes(upload.size_bytes)}
                        </Typography>
                    </Typography>
                    <IconButton size="small" aria-label={`remove ${upload.filename}`} disabled={disabled} onClick={onRemove}>
                        ✕
                    </IconButton>
                </Stack>
                {upload.check_status === 'ok' && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                            select
                            size="small"
                            label="Kind of map"
                            disabled={disabled}
                            value={upload.map_type ?? 'other'}
                            onChange={(event) => onChange({ map_type: event.target.value as MapType })}
                            sx={{ minWidth: 150 }}
                            helperText={upload.map_type_by === 'header' ? 'read from the file' : undefined}
                        >
                            {MAP_TYPES.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {TYPE_LABELS[type]}
                                </MenuItem>
                            ))}
                        </TextField>
                        {member && (
                            <TextField
                                select
                                size="small"
                                label="Goes with"
                                disabled={disabled}
                                value={upload.partner_id ?? ''}
                                onChange={(event) => onChange({ partner_id: event.target.value || null })}
                                SelectProps={{
                                    displayEmpty: true,
                                    renderValue: (value) => {
                                        const chosen = statistics.find((other) => other.id === value);
                                        return chosen ? shownPath(chosen, folder) : 'no t/z map';
                                    },
                                }}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flexGrow: 1 }}
                                helperText={
                                    partner && upload.partner_by ? `paired ${PAIRED_BY[upload.partner_by]}` : undefined
                                }
                            >
                                <MenuItem value="">no t/z map</MenuItem>
                                {statistics.map((other) => (
                                    <MenuItem key={other.id} value={other.id}>
                                        {shownPath(other, folder)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                    </Stack>
                )}
                {upload.check_status === 'ok' && partner && upload.assigned_by !== 'author' && (
                    <Typography variant="body2" color="text.secondary">
                        {upload.analysis_keys.length > 0
                            ? `Goes with ${names(upload.analysis_keys)}, as its t/z map does.`
                            : partner.label
                              ? `Goes with “${partner.label}”, as its t/z map does.`
                              : 'Takes the analysis of its t/z map once that has one.'}
                    </Typography>
                )}
                {upload.check_status === 'ok' && !(partner && upload.assigned_by !== 'author') && (
                    <TextField
                        select
                        size="small"
                        label="This map is for"
                        disabled={disabled}
                        SelectProps={{
                            multiple: true,
                            renderValue: (keys) =>
                                (keys as string[]).length === 0 ? 'None of these analyses' : names(keys as string[]),
                            displayEmpty: true,
                        }}
                        InputLabelProps={{ shrink: true }}
                        value={upload.analysis_keys}
                        onChange={(event) => onChange({ analysis_keys: event.target.value as unknown as string[] })}
                    >
                        {view.analyses.map((analysis) => {
                            const fit = upload.fits[analysis.key];
                            return (
                                <MenuItem key={analysis.key} value={analysis.key}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                        <span style={{ flexGrow: 1 }}>{analysis.name}</span>
                                        {fit && upload.kind === 'statistic' && (
                                            <Chip size="small" color={FITS[fit.outcome].tone} variant="outlined" label={FITS[fit.outcome].label} />
                                        )}
                                    </Stack>
                                </MenuItem>
                            );
                        })}
                    </TextField>
                )}
                {upload.check_status === 'ok' && upload.kind === 'statistic' && upload.analysis_keys.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {upload.analysis_keys.map((key) => {
                            const fit = upload.fits[key];
                            return (
                                <Chip
                                    key={key}
                                    size="small"
                                    color={fit ? FITS[fit.outcome].tone : 'default'}
                                    label={`${names([key])}: ${fit ? FITS[fit.outcome].label : 'not checked'}${
                                        upload.assigned_by === 'suggestion' ? ' (suggested)' : ''
                                    }`}
                                />
                            );
                        })}
                    </Stack>
                )}
                {upload.check_status === 'ok' && upload.analysis_keys.length === 0 && !partner && (
                    <TextField
                        size="small"
                        label="What is this map? (for maps the paper does not table)"
                        value={label}
                        disabled={disabled}
                        onChange={(event) => setLabel(event.target.value)}
                        onBlur={() => label !== (upload.label ?? '') && onChange({ label })}
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

/** What the author submitted: each file and what it is for, so the thank-you page is
 * not the last they see of it. */
function Sent({ view, folder }: { view: ShareView; folder: string }) {
    const names = (keys: string[]) => keys.map((key) => view.analyses.find((a) => a.key === key)?.name).join(', ');
    const files = ordered(view).filter((upload) => upload.check_status === 'ok');
    const issues = view.issues.filter((issue) => issue.kind === 'extraction_error').length;
    return (
        <Section title="What you sent">
            <Stack spacing={0.75}>
                {files.map((upload) => {
                    const partner = view.uploads.find((other) => other.id === upload.partner_id);
                    const what =
                        upload.analysis_keys.length > 0
                            ? names(upload.analysis_keys)
                            : upload.label
                              ? `“${upload.label}”`
                              : partner
                                ? `with ${shownPath(partner, folder)}`
                                : 'no analysis';
                    return (
                        <Typography key={upload.id} variant="body2" sx={{ overflowWrap: 'anywhere', pl: partner ? 2 : 0 }}>
                            {shownPath(upload, folder)}{' '}
                            <Typography component="span" variant="body2" color="text.secondary">
                                · {TYPE_LABELS[upload.map_type ?? 'other']} · {what}
                            </Typography>
                        </Typography>
                    );
                })}
                {issues > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        You also told us about {issues} {issues === 1 ? 'problem' : 'problems'} with the analyses we found.
                        Thank you.
                    </Typography>
                )}
            </Stack>
        </Section>
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
    const [software, setSoftware] = useState(() => defaultSoftware(view.software?.packages));
    const [picking, setPicking] = useState<Candidate[] | null>(null);
    const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
    // Bumped after each message that went through, so its dialog opens empty next time.
    const [told, setTold] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const folder = useRef<HTMLInputElement>(null);
    const instructions = INSTRUCTIONS.find((item) => item.software === software) ?? INSTRUCTIONS[INSTRUCTIONS.length - 1];

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

    /** A message from one of the dialogs: say plainly whether it went through, wherever
     * on the page the author is. */
    async function tell(call: () => Promise<ShareView>, thanks: string) {
        setDialog(null);
        try {
            setView(await call());
            setTold((count) => count + 1);
            setNotice({ tone: 'success', text: thanks });
        } catch (failure) {
            const message = failure instanceof Error ? failure.message : String(failure);
            setNotice({ tone: 'error', text: `That did not go through (${message}). Please try again.` });
        }
    }

    async function send(files: { file: File; path?: string }[]) {
        const accepted: { file: File; path?: string }[] = [];
        const refused: Queued[] = [];
        for (const item of files) {
            const reason = refusal(item.file, view, accepted.length);
            if (reason) refused.push({ name: item.path ?? item.file.name, error: reason });
            else accepted.push(item);
        }
        setQueue([...refused, ...accepted.map((item) => ({ name: item.path ?? item.file.name, error: null }))]);
        for (const { file, path } of accepted) {
            const name = path ?? file.name;
            try {
                setView(await api.upload(file, path));
                setQueue((current) => current.filter((item) => item.name !== name || item.error));
            } catch (failure) {
                const message = failure instanceof Error ? failure.message : String(failure);
                setQueue((current) =>
                    current.map((item) => (item.name === name && !item.error ? { ...item, error: message } : item))
                );
            }
        }
    }

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        if (editable) void send(Array.from(event.dataTransfer.files).map((file) => ({ file })));
    };
    const uploading = queue.some((item) => !item.error);
    const unassigned = view.analyses.filter((a) => !view.uploads.some((u) => u.analysis_keys.includes(a.key)));
    const shared = commonFolder(view.uploads.map((upload) => upload.path));
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
            {submitted && <Sent view={view} folder={shared} />}
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
                        , so others can reuse them. Our software read the paper and found {view.analyses.length}{' '}
                        {view.analyses.length === 1 ? 'analysis' : 'analyses'} in it. Point us at your results folder (or
                        drop in the maps), check that each landed on the right analysis, and submit. It takes a few
                        minutes and needs no account.
                    </Typography>
                    <Button variant="contained" disabled={busy} onClick={() => void run(api.opened)}>
                        Get started
                    </Button>
                </Section>
            )}

            {(started || view.preview) && !submitted && (
                <>
                    <Section step={1} title="Add your maps">
                        <Stack spacing={1} sx={{ mb: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="body2">
                                    We'd like each analysis's unthresholded t or z map and, if you have it, its effect map.
                                    Made with
                                </Typography>
                                <TextField
                                    select
                                    size="small"
                                    value={software}
                                    onChange={(event) => setSoftware(event.target.value)}
                                    inputProps={{ 'aria-label': 'analysis software' }}
                                >
                                    {INSTRUCTIONS.map((item) => (
                                        <MenuItem key={item.software} value={item.software}>
                                            {item.software === 'Other' ? 'other software' : item.software}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>
                            {instructions.before && (
                                <Typography variant="body2" color="text.secondary">
                                    First: {instructions.before}
                                </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary">
                                Choose {instructions.folder} We'll pick out:
                            </Typography>
                            <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                {instructions.files.map((line) => (
                                    <Typography component="li" variant="body2" color="text.secondary" key={line}>
                                        {line}
                                    </Typography>
                                ))}
                            </Box>
                        </Stack>
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
                            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 1 }}>
                                <Button
                                    variant="contained"
                                    disabled={!editable || uploading}
                                    onClick={() => folder.current?.click()}
                                >
                                    Choose a results folder
                                </Button>
                                <Button variant="outlined" disabled={!editable || uploading} onClick={() => input.current?.click()}>
                                    Choose files
                                </Button>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                or drag .nii / .nii.gz files here
                            </Typography>
                            <input
                                ref={folder}
                                hidden
                                type="file"
                                multiple
                                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                                onChange={(event) => {
                                    const remaining = view.limits.max_files - view.uploads.length;
                                    setPicking(pickMaps(withPaths(event.target.files ?? []), remaining));
                                    event.target.value = '';
                                }}
                            />
                            <input
                                ref={input}
                                hidden
                                type="file"
                                multiple
                                accept=".nii,.nii.gz,.gz"
                                onChange={(event) => {
                                    void send(Array.from(event.target.files ?? []).map((file) => ({ file })));
                                    event.target.value = '';
                                }}
                            />
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                                Up to {view.limits.max_files} files, 200 MB each: a t or z map, effect map and variance map
                                for each analysis.
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
                            We compared each t/z map with the coordinates the paper reports and suggested a match; effect
                            and variance maps go with their t/z map. Change any that are wrong. If an analysis below is
                            wrong or missing, tell us; you don't need to fix it.
                        </Typography>
                        {shared && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                                Files from {shared}/
                            </Typography>
                        )}
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={7}>
                                <Stack spacing={1.5}>
                                    {view.uploads.length === 0 && (
                                        <Typography variant="body2">No files yet.</Typography>
                                    )}
                                    {ordered(view).map((upload) => (
                                        <FileRow
                                            key={`${upload.id}-${upload.label ?? ''}`}
                                            upload={upload}
                                            view={view}
                                            folder={shared}
                                            disabled={!editable || busy}
                                            onChange={(change) => void run(() => api.assign(upload.id, change))}
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
                                            {/* A div, not a p: the "no file" chip is a div. */}
                                            <Typography variant="body2" component="div">
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

            {picking && (
                <TreePicker
                    candidates={picking}
                    limit={view.limits.max_files - view.uploads.length}
                    onClose={() => setPicking(null)}
                    onUpload={(chosen) => {
                        setPicking(null);
                        void send(chosen.map(({ file, path }) => ({ file, path })));
                    }}
                />
            )}
            <IssueDialog
                key={`issue-${told}`}
                open={typeof dialog === 'object' && dialog !== null}
                analysis={
                    typeof dialog === 'object' && dialog?.issue
                        ? view.analyses.find((a) => a.key === dialog.issue) ?? null
                        : null
                }
                onClose={() => setDialog(null)}
                onSend={(issue) =>
                    void tell(() => api.issue(issue), "Thanks, we've noted it. You can carry on; you don't need to fix it.")
                }
            />
            <ReplyDialog
                key={`reply-${told}`}
                open={dialog === 'reply'}
                onClose={() => setDialog(null)}
                onSend={(reply) =>
                    void tell(
                        () => api.reply(reply),
                        reply.kind === 'unsubscribe'
                            ? "Done. We won't email this address again."
                            : 'Thanks for letting us know. You can still upload maps here if that changes.'
                    )
                }
            />
            <HelpDialog
                key={`help-${told}`}
                open={dialog === 'help'}
                onClose={() => setDialog(null)}
                onSend={(note) =>
                    void tell(() => api.issue({ kind: 'help', note }), 'Sent. The person who emailed you will reply by email.')
                }
            />
            <Snackbar
                open={notice !== null}
                autoHideDuration={8000}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
            >
                <Alert severity={notice?.tone ?? 'success'} variant="filled" onClose={() => setNotice(null)}>
                    {notice?.text}
                </Alert>
            </Snackbar>
        </Stack>
    );
}
