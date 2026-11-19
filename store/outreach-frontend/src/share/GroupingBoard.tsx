import { Alert, Button, Link, Stack, Typography } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { AnalysisLane } from './AnalysisLane';
import { AnalysisMenu } from './AnalysisMenu';
import type { ShareApi } from './api';
import { BoardColumn } from './BoardColumn';
import { board, moves, type Group } from './grouping';
import { shownPath } from './review';
import type { MapType, ShareUpload, ShareView } from './types';
import { UnassignedColumn } from './UnassignedColumn';

type Change = Parameters<ShareApi['assign']>[1];

/** Step 2: the author's maps sorted onto the paper's analyses. A map the server was
 * sure of is already on its analysis; the rest wait in a pool for the author to move.
 * Nothing here decides where a map goes: it shows what the server saved and sends the
 * author's moves back. */
export function GroupingBoard({
    view,
    folder,
    disabled,
    busy,
    onAssign,
    onChange,
    onRemoveFile,
    onIssue,
}: {
    view: ShareView;
    folder: string;
    disabled: boolean;
    /** A change is going through. */
    busy: boolean;
    onAssign: (changes: { id: string; keys: string[] }[]) => void;
    onChange: (id: string, change: Change) => void;
    onRemoveFile: (id: string) => void;
    /** Report a problem with one analysis, or (null) a missing one. */
    onIssue: (analysisKey: string | null) => void;
}) {
    // The map whose three dots are open. A group is set for a t/z map, which can move;
    // its effect and variance maps go with it.
    const [menu, setMenu] = useState<{
        el: HTMLElement;
        upload: ShareUpload;
        group: Group | null;
        from: string | null;
    } | null>(null);
    // Maps the author said the paper does not table, so their description field shows.
    const [describing, setDescribing] = useState<Set<string>>(new Set());
    const [acting, setActing] = useState<string | null>(null);
    const { pool, lanes } = board(view);
    const problems = view.uploads.filter((upload) => upload.check_status === 'problem');
    const statistics = view.uploads.filter(
        (upload) =>
            upload.check_status === 'ok' &&
            (upload.map_type === 't' || upload.map_type === 'z' || upload.map_type === 'f')
    );

    // An effect or variance map chooses between an analysis (on its own) and a t/z map (to go
    // with it, on that map's analyses). A t/z map can only be moved to an analysis.
    const asMember = menu?.upload.kind === 'effect' || menu?.upload.kind === 'variance';
    const candidates = statistics.filter((other) => other.id !== menu?.upload.id);

    function assign(group: Group, to: string | null, from: string | null) {
        setActing(group.lead.id);
        onAssign(moves(group, to, from));
    }

    const list = {
        view,
        folder,
        disabled: disabled || busy,
        loadingId: busy ? acting : null,
        onMenu: (event: MouseEvent<HTMLElement>, upload: ShareUpload, group: Group | null, from: string | null) =>
            setMenu({ el: event.currentTarget, upload, group, from }),
        onKind: (id: string, map_type: MapType) => onChange(id, { map_type }),
        onRemoveFile,
        onUnassign: (group: Group, from: string) => assign(group, null, from),
        // Unpair and say it is on no analysis, in one request, so the server does not place it again.
        onDetach: (upload: ShareUpload) => {
            setActing(upload.id);
            onChange(upload.id, { partner_id: null, analysis_keys: [] });
        },
        onLabel: (id: string, label: string) => onChange(id, { label }),
        describing,
        onDescribe: (id: string) => setDescribing(new Set(describing).add(id)),
    };

    return (
        <Stack spacing={2}>
            {problems.map((upload) => (
                <Alert
                    key={upload.id}
                    severity="error"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            disabled={list.disabled}
                            onClick={() => onRemoveFile(upload.id)}
                        >
                            Remove
                        </Button>
                    }
                >
                    {shownPath(upload, folder)}: {upload.problem ?? 'This file cannot be used.'}
                </Alert>
            ))}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                <UnassignedColumn
                    groups={pool}
                    empty={view.uploads.length === 0 ? 'No files yet.' : 'Every map is on an analysis.'}
                    {...list}
                />
                <BoardColumn
                    id="analyses-heading"
                    title="Analyses"
                    flush
                    action={
                        <Link component="button" variant="body2" disabled={view.preview} onClick={() => onIssue(null)}>
                            An analysis is missing
                        </Link>
                    }
                >
                    {view.issues.some((issue) => issue.reason === 'missing_analysis') && (
                        <Typography variant="caption" color="warning.main" sx={{ px: 2, py: 1 }}>
                            You told us an analysis is missing. Thank you.
                        </Typography>
                    )}
                    {view.analyses.map((analysis) => (
                        <AnalysisLane
                            key={analysis.key}
                            analysis={analysis}
                            groups={lanes.get(analysis.key) ?? []}
                            issues={view.issues.filter((issue) => issue.analysis_key === analysis.key)}
                            preview={view.preview}
                            onIssue={() => onIssue(analysis.key)}
                            {...list}
                        />
                    ))}
                </BoardColumn>
            </Stack>
            <AnalysisMenu
                anchorEl={menu?.el ?? null}
                onClose={() => setMenu(null)}
                analyses={view.analyses.map((analysis) => ({
                    ...analysis,
                    count: view.uploads.filter((upload) => upload.analysis_keys.includes(analysis.key)).length,
                    maps: asMember
                        ? candidates
                              .filter((other) => other.analysis_keys.includes(analysis.key))
                              .map((other) => ({
                                  id: other.id,
                                  name: shownPath(other, folder),
                              }))
                        : undefined,
                }))}
                title={asMember ? 'Assign to an analysis or a t/z map' : 'Assign to analysis'}
                current={menu?.from ?? null}
                currentMap={menu?.upload.partner_id ?? null}
                unplaced={
                    asMember
                        ? candidates
                              .filter((other) => !other.analysis_keys.some((key) => lanes.has(key)))
                              .map((other) => ({
                                  id: other.id,
                                  name: shownPath(other, folder),
                              }))
                        : []
                }
                fits={menu?.upload.kind === 'variance' ? undefined : menu?.upload.fits}
                onSelect={(to) => {
                    if (!menu) return;
                    if (menu.group) assign(menu.group, to, menu.from);
                    // Inside a t/z map's card: unpair, and put it on the analysis in one request.
                    else onChange(menu.upload.id, { partner_id: null, analysis_keys: [to] });
                    setMenu(null);
                }}
                onSelectMap={
                    asMember
                        ? (partner_id) => {
                              onChange(menu!.upload.id, { partner_id });
                              setMenu(null);
                          }
                        : undefined
                }
            />
        </Stack>
    );
}
