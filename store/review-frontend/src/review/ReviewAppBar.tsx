import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SyncIcon from '@mui/icons-material/Sync';
import { AppBar, Box, Button, Chip, Toolbar, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { Brand } from '../Brand';
import { editSummary } from '../format/editSummary';
import { copyNote, type TextCopy } from '../format/textCopy';
import { displayName } from '../format/people';
import { useSession, useView } from '../store/context';
import { selectIsBlocked, selectSaveLabel, type SessionState } from '../store/sessionStore';
import { Hint } from './Hint';

const STATES = {
    in_progress: 'in progress',
    submitted: 'submitted',
    reference: 'reference',
    set_aside: 'set aside',
} as const;

const toggleMeans = (count: number) =>
    count === 0
        ? 'This paper has no analyses without coordinates; when one has, this shows or hides them (Shift+H)'
        : `Show or hide the ${count} ${count === 1 ? 'analysis' : 'analyses'} with no coordinates, on the Coordinates and Analyses steps (Shift+H)`;

function selectTextCopy(s: Pick<SessionState, 'bundle'>): TextCopy | undefined {
    return (s.bundle.parsed_paper as { text_copy?: TextCopy }).text_copy;
}

/** The review's state, then each reviewer who has edited the paper: their ops and last edit, and its exact time. */
function selectStateNote(s: Pick<SessionState, 'bundle'>, now: Date): string {
    const state = s.bundle.review ? STATES[s.bundle.review.state] : 'new review';
    const edits = s.bundle.reviewers.flatMap((editor) =>
        editor.op_count > 0 && editor.last_edit_at
            ? [
                  `${displayName(editor)}: ${editSummary(editor.op_count, editor.last_edit_at, now)} (${new Date(editor.last_edit_at).toLocaleString()})`,
              ]
            : []
    );
    return [state, ...edits].join('. ');
}

const SAVE_ICON_WIDTH = 28;

/** The save state as one icon of fixed width, its words in its label and tooltip. */
function SaveIndicator() {
    const saved = useSession(selectSaveLabel);
    const blocked = useSession(selectIsBlocked);
    const save = useSession((s) => s.save);
    const unsaved = useSession((s) => s.pending.length > 0);
    const icon: ReactElement =
        blocked || save === 'failed' || save === 'signin' ? (
            <ErrorOutlineIcon fontSize="small" />
        ) : save === 'offline' ? (
            <CloudOffOutlinedIcon fontSize="small" />
        ) : save === 'saving' ? (
            <SyncIcon fontSize="small" />
        ) : unsaved ? (
            <CloudUploadOutlinedIcon fontSize="small" />
        ) : (
            <CloudDoneOutlinedIcon fontSize="small" />
        );
    return (
        <Hint title={saved}>
            <Box
                role="status"
                aria-label={`save state: ${saved}`}
                sx={{
                    width: SAVE_ICON_WIDTH,
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    color: blocked ? 'error.main' : 'inherit',
                }}
            >
                {icon}
            </Box>
        </Hint>
    );
}

export function ReviewAppBar() {
    const label = useSession((s) => s.bundle.source.label);
    const textCopy = useSession(selectTextCopy);
    const copyLabel = textCopy ? copyNote(textCopy) : null;
    const state = useSession((s) => (s.bundle.review ? STATES[s.bundle.review.state] : 'new review'));
    const stateNote = useSession((s) => selectStateNote(s, new Date()));
    const showing = useView((s) => s.showNonCoordinate);
    const nonCoordinate = useSession((s) => s.bundle.hidden.analyses.length);
    const toggleNonCoordinate = useView((s) => s.toggleNonCoordinate);
    const toggleHelp = useView((s) => s.toggleHelp);
    return (
        <AppBar position="static" elevation={0}>
            <Toolbar variant="dense" sx={{ gap: 2 }}>
                <Brand />
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Hint title={label}>
                        <Typography variant="body1" noWrap sx={{ minWidth: 0 }}>
                            {label}
                        </Typography>
                    </Hint>
                    {textCopy && copyLabel ? (
                        <Typography
                            variant="caption"
                            sx={{ whiteSpace: 'nowrap', opacity: 0.8 }}
                            title={textCopy.license?.stated_as ?? undefined}
                            aria-label={`text copy: ${copyLabel}`}
                        >
                            {copyLabel}
                        </Typography>
                    ) : null}
                </Box>
                <Hint title={stateNote}>
                    <Chip
                        size="small"
                        label={state}
                        aria-label={`review state: ${state}`}
                        sx={{ color: 'inherit', borderColor: 'currentColor' }}
                        variant="outlined"
                    />
                </Hint>
                <Hint title={toggleMeans(nonCoordinate)}>
                    <span>
                        <Button
                            size="small"
                            color="inherit"
                            variant={showing ? 'contained' : 'outlined'}
                            aria-pressed={showing}
                            disabled={nonCoordinate === 0}
                            sx={{ whiteSpace: 'nowrap', '&.Mui-disabled': { color: 'inherit', opacity: 0.5 } }}
                            onClick={() => toggleNonCoordinate()}
                        >
                            non-coordinate analyses
                        </Button>
                    </span>
                </Hint>
                <Hint title="Keyboard shortcuts and help (?)">
                    <Button
                        size="small"
                        color="inherit"
                        startIcon={<HelpOutlineIcon fontSize="small" />}
                        onClick={() => toggleHelp(true)}
                    >
                        Help
                    </Button>
                </Hint>
                <SaveIndicator />
            </Toolbar>
        </AppBar>
    );
}
