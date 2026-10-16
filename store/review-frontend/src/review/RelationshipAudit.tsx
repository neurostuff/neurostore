import { Box, ButtonBase, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { memo, useMemo } from 'react';
import { link, pendingStructure, unlink } from '../inspector/actions';
import { InspectorFrame } from '../inspector/Inspector';
import { useReviewStores, useSession, useShown } from '../store/context';
import type { EntityNode } from '../model/record';
import { auditMatrix, type AuditGroup, type AuditMatrix } from '../model/guided';

const cellStyles = { p: 0.25, textAlign: 'center' } as const;
const headStyles = { px: 0.5, py: 0.5, whiteSpace: 'nowrap' } as const;
const nameStyles = {
    ...headStyles,
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    maxHeight: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'bottom',
} as const;

const LinkCell = memo(function LinkCell({
    label,
    slot,
    entity,
    linked,
    busy,
}: {
    label: string;
    slot?: string;
    entity: string;
    linked: boolean;
    busy: boolean;
}) {
    const stores = useReviewStores();
    const toggle = () => {
        const node = slot === undefined ? undefined : stores.session.getState().index.slot(slot);
        if (node) (linked ? unlink : link)(stores, node, entity);
    };
    return (
        <TableCell sx={cellStyles}>
            <ButtonBase
                aria-label={label}
                aria-pressed={linked}
                aria-busy={busy || undefined}
                disabled={slot === undefined || busy}
                title={label}
                onClick={toggle}
                sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1,
                    border: 1,
                    borderColor: slot === undefined ? 'transparent' : 'divider',
                    bgcolor: linked ? 'primary.main' : 'transparent',
                    color: linked ? 'primary.contrastText' : 'text.secondary',
                    '&:hover': { borderColor: 'primary.main' },
                }}
            >
                {busy ? '…' : linked ? '✓' : ''}
            </ButtonBase>
        </TableCell>
    );
});

const NONE: ReadonlySet<string> = new Set();

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** One analysis's row; `busy` holds its pending `slot key, target` links, so other rows skip a render. */
const AuditRow = memo(
    function AuditRow({
        analysis,
        matrix,
        busy,
    }: {
        analysis: EntityNode;
        matrix: AuditMatrix;
        busy: ReadonlySet<string>;
    }) {
        return (
            <TableRow hover>
                <TableCell component="th" scope="row" sx={{ ...headStyles, maxWidth: 220 }}>
                    {analysis.name}
                </TableCell>
                {matrix.groups.flatMap((group) =>
                    group.columns.map((entity) => {
                        const { holding, slot } = matrix.cell(analysis, group.className, entity);
                        return (
                            <LinkCell
                                key={`${group.className}:${entity.id}`}
                                label={`${analysis.name} → ${entity.name}`}
                                slot={slot?.key}
                                entity={entity.id}
                                linked={holding !== undefined}
                                busy={slot !== undefined && busy.has(`${slot.key} ${entity.id}`)}
                            />
                        );
                    })
                )}
            </TableRow>
        );
    },
    (before, after) =>
        before.analysis === after.analysis && before.matrix === after.matrix && sameSet(before.busy, after.busy)
);

const AuditHead = memo(function AuditHead({ groups }: { groups: AuditGroup[] }) {
    return (
        <TableHead>
            <TableRow>
                <TableCell sx={headStyles} />
                {groups.map((group) => (
                    <TableCell
                        key={group.className}
                        colSpan={group.columns.length}
                        sx={{ ...headStyles, borderLeft: 1, borderColor: 'divider' }}
                    >
                        {group.className}
                    </TableCell>
                ))}
            </TableRow>
            <TableRow>
                <TableCell sx={headStyles}>analysis</TableCell>
                {groups.flatMap((group) =>
                    group.columns.map((entity) => (
                        <TableCell key={`${group.className}:${entity.id}`} sx={nameStyles} title={entity.name}>
                            {entity.name}
                        </TableCell>
                    ))
                )}
            </TableRow>
        </TableHead>
    );
});

/** The pending link and unlink ops by the entity they come from, each as `slot key, target` lines. */
function busyByEntity(
    pending: ReturnType<typeof pendingStructure>['linksBySlot'],
    index: { slot(key: string): { entity: string } | undefined }
) {
    const busy = new Map<string, Set<string>>();
    for (const [slotKey, targets] of pending) {
        const entity = index.slot(slotKey)?.entity;
        if (entity === undefined) continue;
        const lines = busy.get(entity) ?? new Set<string>();
        for (const target of targets.keys()) lines.add(`${slotKey} ${target}`);
        busy.set(entity, lines);
    }
    return busy;
}

/** Step 5: the analyses against each class they link to; a click on a cell links or unlinks. */
export function RelationshipAudit() {
    const matrix = useShown(auditMatrix);
    const pending = useSession((s) => s.pending);
    const index = useSession((s) => s.index);
    const busy = useMemo(() => busyByEntity(pendingStructure({ pending }).linksBySlot, index), [pending, index]);
    return (
        <InspectorFrame>
            <Typography variant="overline" component="h2" sx={{ px: 2, display: 'block' }}>
                relationship audit
            </Typography>
            {matrix.rows.length === 0 || matrix.groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                    No links to audit.
                </Typography>
            ) : (
                <Box sx={{ overflow: 'auto' }}>
                    <Table size="small" stickyHeader aria-label="relationship audit">
                        <AuditHead groups={matrix.groups} />
                        <TableBody>
                            {matrix.rows.map((analysis) => (
                                <AuditRow
                                    key={analysis.id}
                                    analysis={analysis}
                                    matrix={matrix}
                                    busy={busy.get(analysis.id) ?? NONE}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            )}
        </InspectorFrame>
    );
}
