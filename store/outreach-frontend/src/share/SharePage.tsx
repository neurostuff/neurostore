import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
    MenuItem,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { ShareApi } from './api';
import { CollectionDetails } from './CollectionDetails';
import { PaperCard } from './PaperCard';
import { StepCard } from './StepCard';
import { SubmitForm } from './SubmitForm';
import { SubmitSummary } from './SubmitSummary';
import { UploadedFolders } from './UploadedFolders';
import { GroupingBoard } from './GroupingBoard';
import { defaultSoftware, INSTRUCTIONS } from './instructions';
import { commonFolder, ordered, planUpload, prompts, shownPath, TYPE_LABELS, usableFiles, type Tone } from './review';
import { HelpDialog, IssueDialog, ReplyDialog } from './ShareDialogs';
import { droppedEntries, filesUnder, withPaths } from './files';
import type { ShareView } from './types';

const NOT_STARTED = ['draft', 'checked', 'contacted'];

interface Queued {
    name: string;
    error: string | null;
}

/** What the author submitted: each file and what it is for, so the thank-you page is
 * not the last they see of it. */
function Sent({ view, folder }: { view: ShareView; folder: string }) {
    const names = (keys: string[]) => keys.map((key) => view.analyses.find((a) => a.key === key)?.name).join(', ');
    const files = ordered(view).filter((upload) => upload.check_status === 'ok');
    const issues = view.issues.filter((issue) => issue.kind === 'extraction_error').length;
    return (
        <StepCard title="What you sent">
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
                        <Typography
                            key={upload.id}
                            variant="body2"
                            sx={{ overflowWrap: 'anywhere', pl: partner ? 2 : 0 }}
                        >
                            {shownPath(upload, folder)}{' '}
                            <Typography component="span" variant="body2" color="text.secondary">
                                · {TYPE_LABELS[upload.map_type ?? 'other']} · {what}
                            </Typography>
                        </Typography>
                    );
                })}
                {issues > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        You also told us about {issues} {issues === 1 ? 'problem' : 'problems'} with the analyses we
                        found. Thank you.
                    </Typography>
                )}
            </Stack>
        </StepCard>
    );
}

export function SharePage({ api, initial }: { api: ShareApi; initial: ShareView }) {
    const [view, setView] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [queue, setQueue] = useState<Queued[]>([]);
    const [dialog, setDialog] = useState<'help' | 'reply' | { issue: string | null } | null>(null);
    const [busy, setBusy] = useState(false);
    // Files waiting on the author's confirmation before they are deleted.
    const [pendingRemoval, setPendingRemoval] = useState<string[] | null>(null);
    const [software, setSoftware] = useState(() => defaultSoftware(view.software?.packages));
    const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
    // Bumped after each message that went through, so its dialog opens empty next time.
    const [told, setTold] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const folder = useRef<HTMLInputElement>(null);
    const instructions =
        INSTRUCTIONS.find((item) => item.software === software) ?? INSTRUCTIONS[INSTRUCTIONS.length - 1];

    const started = !NOT_STARTED.includes(view.status);
    const editable = view.open && !view.preview;
    const submitted = ['submitted', 'approved', 'published'].includes(view.status);

    // Only sets state, so it never changes; the memoised cards rely on that.
    const run = useCallback(async (call: () => Promise<ShareView>) => {
        setError(null);
        setBusy(true);
        try {
            setView(await call());
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
            setBusy(false);
        }
    }, []);
    const saveDetails = useCallback(
        (details: Record<string, string>) => void run(() => api.metadata(details)),
        [run, api],
    );

    /** Moves from the board: a group's maps are set one after another, so the page shows
     * the result of the last. */
    function assign(changes: { id: string; keys: string[] }[]) {
        return run(async () => {
            let latest = view;
            for (const { id, keys } of changes) latest = await api.assign(id, { analysis_keys: keys });
            return latest;
        });
    }

    /** Takes files off the draft one after another, as a whole folder's go together. */
    function removeAll(ids: string[]) {
        return run(async () => {
            let latest = view;
            for (const id of ids) latest = await api.remove(id);
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
            setNotice({
                tone: 'error',
                text: `That did not go through (${message}). Please try again.`,
            });
        }
    }

    /** Uploads what the author chose, a file at a time. What cannot go, and what did not fit,
     * is said once each, not once per file. */
    async function send(files: { file: File; path?: string }[]) {
        const plan = planUpload(files, view);
        const notes: Queued[] = plan.refused.map(({ name, reason }) => ({
            name,
            error: reason,
        }));
        if (plan.over > 0) {
            const count = `${plan.over} more ${plan.over === 1 ? 'map was' : 'maps were'}`;
            notes.push({
                name: 'Not added',
                error: `${count} ecxluded: ${view.limits.max_files} files is the maximum. Remove some files, or choose a smaller folder.`,
            });
        }
        if (plan.empty)
            notes.push({
                name: 'Nothing to add',
                error: 'We found no new .nii or .nii.gz files there.',
            });
        setQueue([
            ...notes,
            ...plan.accepted.map((item) => ({
                name: item.path ?? item.file.name,
                error: null,
            })),
        ]);
        for (const { file, path } of plan.accepted) {
            const name = path ?? file.name;
            try {
                setView(await api.upload(file, path));
                setQueue((current) => current.filter((item) => item.name !== name || item.error));
            } catch (failure) {
                const message = failure instanceof Error ? failure.message : String(failure);
                setQueue((current) =>
                    current.map((item) => (item.name === name && !item.error ? { ...item, error: message } : item)),
                );
            }
        }
    }

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        if (!editable) return;
        const entries = droppedEntries(event.dataTransfer.items);
        if (entries.some((entry) => entry.isDirectory)) {
            Promise.all(entries.map(filesUnder))
                .then((found) => send(found.flat()))
                .catch(() => setError('We could not read the dropped folder. Try "Choose a folder" instead.'));
            return;
        }
        void send(Array.from(event.dataTransfer.files).map((file) => ({ file })));
    };
    const uploading = queue.some((item) => !item.error);
    // What is still open before submitting: analyses with no file (shown nowhere else)
    // and how many files above carry a note.
    const reminders = prompts(view);
    const unfiled = reminders.filter((prompt) => !prompt.uploadId);
    const flagged = new Set(reminders.filter((prompt) => prompt.uploadId).map((prompt) => prompt.uploadId)).size;
    const shared = commonFolder(view.uploads.map((upload) => upload.path));
    const { paper } = view;

    return (
        <Stack spacing={3}>
            <PaperCard paper={paper} />

            {view.preview && (
                <Alert severity="info">
                    Preview: this is the author's page. Nothing you do here is recorded or kept.
                </Alert>
            )}
            {!view.open && !submitted && <Alert severity="info">{view.closed_reason}</Alert>}
            {submitted && (
                <Alert severity="success">
                    Thank you. We have your maps and will check them before they are published on NeuroVault. We will
                    email you when your collection is live.
                </Alert>
            )}
            {submitted && <Sent view={view} folder={shared} />}
            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {editable && !started && (
                <StepCard title="Add your maps to NeuroVault" subtitle="A few minutes, no account needed.">
                    <Typography sx={{ mb: 3 }}>
                        We'd like to share this paper's group-level maps on{' '}
                        <Link href="https://neurovault.org" target="_blank" rel="noreferrer">
                            NeuroVault
                        </Link>{' '}
                        so others can reuse them. We found {view.analyses.length}{' '}
                        {view.analyses.length === 1 ? 'analysis' : 'analyses'} in your paper.
                    </Typography>
                    <Button variant="contained" size="large" disabled={busy} onClick={() => void run(api.opened)}>
                        Get started
                    </Button>
                </StepCard>
            )}

            {(started || view.preview) && !submitted && (
                <>
                    <StepCard
                        step={1}
                        title="Add your maps"
                        subtitle="Choose the folder your group-level results are in."
                    >
                        <Stack spacing={1} sx={{ mb: 3 }}>
                            <TextField
                                select
                                size="small"
                                label="Maps made with"
                                value={software}
                                onChange={(event) => setSoftware(event.target.value)}
                                sx={{ maxWidth: 240 }}
                            >
                                {INSTRUCTIONS.map((item) => (
                                    <MenuItem key={item.software} value={item.software}>
                                        {item.software === 'Other' ? 'Other software' : item.software}
                                    </MenuItem>
                                ))}
                            </TextField>
                            {instructions.before && (
                                <Typography variant="body2" color="text.secondary">
                                    First: {instructions.before}
                                </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary">
                                Choose {instructions.folder} The maps we want are:
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
                                p: 3,
                                textAlign: 'center',
                                transition: 'background-color 0.2s, border-color 0.2s',
                                '&:hover': {
                                    bgcolor: 'action.hover',
                                    borderColor: 'primary.main',
                                },
                            }}
                        >
                            <Button
                                variant="contained"
                                size="large"
                                disabled={!editable || uploading}
                                onClick={() => folder.current?.click()}
                            >
                                Choose a folder
                            </Button>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                or drop it here ·{' '}
                                <Link
                                    component="button"
                                    type="button"
                                    disabled={!editable || uploading}
                                    onClick={() => input.current?.click()}
                                >
                                    choose files
                                </Link>
                            </Typography>
                            <input
                                ref={folder}
                                hidden
                                type="file"
                                multiple
                                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                                onChange={(event) => {
                                    void send(withPaths(event.target.files ?? []));
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
                                    void send(
                                        Array.from(event.target.files ?? []).map((file) => ({
                                            file,
                                        })),
                                    );
                                    event.target.value = '';
                                }}
                            />
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
                                Up to {view.limits.max_files} files, 200 MB each.
                            </Typography>
                        </Box>
                        {queue.map((item) => (
                            <Alert key={item.name} severity={item.error ? 'error' : 'info'} sx={{ mt: 1 }}>
                                {item.name}: {item.error ?? 'uploading and checking…'}
                            </Alert>
                        ))}
                        {view.uploads.length > view.analyses.length * 3 && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                The number of maps you have uploaded is more than we expect for this paper. Double check that you are uploading the correct files. This is just
                                a warning, and does not impact the upload process.
                            </Alert>
                        )}
                        <UploadedFolders
                            view={view}
                            disabled={!editable || busy || uploading}
                            onRemove={(ids) => void removeAll(ids)}
                        />
                    </StepCard>

                    <StepCard
                        step={2}
                        title="Check each map"
                        subtitle="Ensure all maps have been upladed before moving to this step. For maps that we were sure of, we've auto assigned them to their respective analysis. Assign the rest, or continue to the next step."
                    >
                        {shared && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                sx={{ mb: 1, overflowWrap: 'anywhere' }}
                            >
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
                            onRemoveFile={(id) => setPendingRemoval([id])}
                            onIssue={(issue) => setDialog({ issue })}
                        />
                    </StepCard>

                    <CollectionDetails
                        collection={view.collection}
                        disabled={!editable}
                        busy={busy}
                        onSave={saveDetails}
                    />

                    <StepCard step={4} title="Submit" subtitle="We check everything before it is published.">
                        <Stack spacing={2}>
                            {usableFiles(view).length > 0 && (
                                <Stack spacing={2}>
                                    <SubmitSummary view={view} />
                                    <Stack spacing={1} sx={{ my: 1.5 }}>
                                        {flagged > 0 && (
                                            <Alert severity="info" sx={{ py: 0 }}>
                                                {flagged === 1
                                                    ? 'One file above still has a note'
                                                    : `${flagged} maps above are still either unassigned or contain warnings`}
                                                . This is nonblocking - you can submit anyway.
                                            </Alert>
                                        )}
                                        {unfiled.map((prompt) => (
                                            <Alert
                                                key={`${prompt.uploadId}:${prompt.analysisKey}:${prompt.text}`}
                                                severity={prompt.tone}
                                                sx={{ py: 0 }}
                                            >
                                                {prompt.body ?? prompt.text}
                                            </Alert>
                                        ))}
                                    </Stack>
                                </Stack>
                            )}
                            <SubmitForm
                                initialName={view.submitter_name ?? ''}
                                initialOrcid={view.submitter_orcid ?? ''}
                                disabled={!editable}
                                busy={busy || uploading}
                                count={usableFiles(view).length}
                                onSubmit={(author) => void run(() => api.submit(author))}
                            />
                        </Stack>
                    </StepCard>
                </>
            )}

            {editable && !submitted && (
                <Stack direction="row" spacing={2}>
                    <Button onClick={() => setDialog('reply')}>Can't share these maps?</Button>
                    <Button onClick={() => setDialog('help')}>Need help?</Button>
                </Stack>
            )}

            <Dialog open={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}>
                <DialogTitle>
                    Delete {pendingRemoval && pendingRemoval.length > 1 ? 'these maps' : 'this map'}?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {pendingRemoval && pendingRemoval.length > 1
                            ? `Are you sure you want to delete these ${pendingRemoval.length} maps?`
                            : 'Are you sure you want to delete this map?'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingRemoval(null)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            const ids = pendingRemoval ?? [];
                            setPendingRemoval(null);
                            void removeAll(ids);
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
            <IssueDialog
                key={`issue-${told}`}
                open={typeof dialog === 'object' && dialog !== null}
                analysis={
                    typeof dialog === 'object' && dialog?.issue
                        ? (view.analyses.find((a) => a.key === dialog.issue) ?? null)
                        : null
                }
                onClose={() => setDialog(null)}
                onSend={(issue) =>
                    void tell(
                        () => api.issue(issue),
                        "Thanks, we've noted it. You can carry on; you don't need to fix it.",
                    )
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
                            : 'Thanks for letting us know. You can still upload maps here if that changes.',
                    )
                }
            />
            <HelpDialog
                key={`help-${told}`}
                open={dialog === 'help'}
                onClose={() => setDialog(null)}
                onSend={(note) =>
                    void tell(
                        () => api.issue({ kind: 'help', note }),
                        'Sent. The person who emailed you will reply by email.',
                    )
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
