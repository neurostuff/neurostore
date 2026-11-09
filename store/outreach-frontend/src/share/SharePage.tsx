import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
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
import { GroupingBoard } from './GroupingBoard';
import { defaultSoftware, INSTRUCTIONS } from './instructions';
import {
    commonFolder,
    ordered,
    prompts,
    refusal,
    shownPath,
    TYPE_LABELS,
    usableFiles,
    type Tone,
} from './review';
import { HelpDialog, IssueDialog, ReplyDialog } from './ShareDialogs';
import { droppedEntries, filesUnder, pickMaps, withPaths, type Candidate } from './tree';
import { TreePicker } from './TreePicker';
import type { ShareView } from './types';

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

    /** Moves from the board: a group's maps are set one after another, so the page shows
     * the result of the last. */
    function assign(changes: { id: string; keys: string[] }[]) {
        return run(async () => {
            let latest = view;
            for (const { id, keys } of changes) latest = await api.assign(id, { analysis_keys: keys });
            return latest;
        });
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
        if (!editable) return;
        const entries = droppedEntries(event.dataTransfer.items);
        if (entries.some((entry) => entry.isDirectory)) {
            // A dropped folder goes through the same picker as a chosen one.
            const remaining = view.limits.max_files - view.uploads.length;
            Promise.all(entries.map(filesUnder))
                .then((found) => setPicking(pickMaps(found.flat(), remaining)))
                .catch(() => setError('We could not read the dropped folder. Try "Choose a results folder" instead.'));
            return;
        }
        void send(Array.from(event.dataTransfer.files).map((file) => ({ file })));
    };
    const uploading = queue.some((item) => !item.error);
    const unassigned = view.analyses.filter((a) => !view.uploads.some((u) => u.analysis_keys.includes(a.key)));
    // What is still open before submitting: analyses with no file (shown nowhere else)
    // and how many files above carry a note.
    const reminders = prompts(view);
    const unfiled = reminders.filter((prompt) => !prompt.uploadId);
    const flagged = new Set(reminders.filter((prompt) => prompt.uploadId).map((prompt) => prompt.uploadId)).size;
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
                                or drop your results folder, or .nii / .nii.gz files, here
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
                            We compared each t/z map with the coordinates the paper reports and placed the ones we were sure
                            of on their analysis. The rest wait under "Unassigned maps": move each to its analysis, or leave
                            it out. Effect and variance maps go with their t/z map. Change any that are wrong. If an
                            analysis below is wrong or missing, tell us; you don't need to fix it.
                        </Typography>
                        {shared && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                                Files from {shared}/
                            </Typography>
                        )}
                        <GroupingBoard
                            view={view}
                            folder={shared}
                            disabled={!editable}
                            busy={busy}
                            onAssign={(changes) => void assign(changes)}
                            onChange={(id, change) => void run(() => api.assign(id, change))}
                            onRemoveFile={(id) => void run(() => api.remove(id))}
                            onIssue={(issue) => setDialog({ issue })}
                        />
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
                            {usableFiles(view).length > 0 && (
                                <Stack spacing={0.75}>
                                    <Typography variant="body2">
                                        You're sending {usableFiles(view).length} map
                                        {usableFiles(view).length === 1 ? '' : 's'} covering{' '}
                                        {view.analyses.length - unassigned.length} of the paper's {view.analyses.length}{' '}
                                        {view.analyses.length === 1 ? 'analysis' : 'analyses'}.
                                    </Typography>
                                    {unfiled.map((prompt) => (
                                        <Alert key={prompt.text} severity={prompt.tone} sx={{ py: 0 }}>
                                            {prompt.text}
                                        </Alert>
                                    ))}
                                    {flagged > 0 && (
                                        <Alert severity="info" sx={{ py: 0 }}>
                                            {flagged === 1
                                                ? 'One file above still has a note'
                                                : `${flagged} files above still have notes`}
                                            . Submitting anyway is fine; we check everything before it is published.
                                        </Alert>
                                    )}
                                </Stack>
                            )}
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
                    analyses={view.analyses}
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
