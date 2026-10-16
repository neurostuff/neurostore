import { List, ListItem, Stack, Typography } from '@mui/material';
import { useId, useMemo, useState } from 'react';
import type { CoordinateOp } from '../contract/generated/review-ops';
import { fromSchema } from '../contract/schemas';
import { ConfirmDialog, DanglingList, PickPanel } from '../inspector/panels';
import { panelKeys } from '../inspector/panelKeys';
import { ScalarField } from '../inspector/SlotEditor';
import { currentAnalyses, type CoordinateAnalysis, type CoordinatePoint } from '../model/coordinates';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import type { ParsedPaperLayout } from '../text/layout';
import {
    addAnalysis,
    mergeAnalyses,
    mergePreview,
    mergeSet,
    movePoints,
    moveTargets,
    movingPoints,
    relabelAnalysis,
    savePoint,
} from './actions';
import { PointEditor } from './PointEditor';
import { analysisFields } from './schema';

const editorsOf = fromSchema('coordinate-parse', (schema) => {
    const fields = analysisFields(schema);
    const closedChoice = (field: string) => {
        const spec = fields[field];
        return spec?.kind === 'enum' ? { ...spec, open: false } : spec;
    };
    return { name: fields.name, roles: closedChoice('role'), spaces: closedChoice('coordinate_space') };
});
type Role = NonNullable<CoordinateOp['role']>;

export function RelabelPanel({ analysis }: { analysis: CoordinateAnalysis }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const editors = editorsOf();
    const id = useId();
    const [role, setRole] = useState(analysis.role);
    const save = () => {
        if (role === analysis.role || relabelAnalysis(store.getState(), role as Role)) closePanel();
    };
    return (
        <Stack
            role="group"
            aria-label={`relabel ${analysis.name}`}
            sx={{ py: 1 }}
            onKeyDown={panelKeys(save, closePanel)}
        >
            {editors.roles && (
                <ScalarField
                    id={id}
                    label="role"
                    spec={editors.roles}
                    value={role}
                    error=""
                    autoFocus
                    onChange={setRole}
                />
            )}
        </Stack>
    );
}

export function MergeDialog() {
    const store = useReviewStoreApi();
    const [into, ...others] = useMemo(() => mergeSet(store.getState()), [store]);
    const { removed, dangling } = useMemo(() => mergePreview(store.getState()), [store]);
    return (
        <ConfirmDialog
            title={`Merge ${others.length + 1} analyses into ${into.name}?`}
            confirmLabel="Merge"
            onConfirm={() => mergeAnalyses(store.getState())}
        >
            <Typography variant="body2">{`Their points follow ${into.name}’s: ${others.map((a) => a.name).join(', ')}.`}</Typography>
            {removed.length > 0 && (
                <>
                    <Typography variant="body2">These cards leave the record:</Typography>
                    <List dense aria-label="cards removed">
                        {removed.map((entity) => (
                            <ListItem key={entity.id} disableGutters>
                                {entity.name}
                            </ListItem>
                        ))}
                    </List>
                </>
            )}
            {dangling.length > 0 && <DanglingList links={dangling} />}
            <Typography variant="caption" color="text.secondary">
                A preview: the server applies the merge and reports every link it leaves.
            </Typography>
        </ConfirmDialog>
    );
}

export function MovePanel() {
    const store = useReviewStoreApi();
    const options = useMemo(() => moveTargets(store.getState()), [store]);
    const count = useMemo(() => movingPoints(store.getState()).length, [store]);
    return (
        <PickPanel
            options={options}
            label={`move ${count} point${count === 1 ? '' : 's'} to`}
            noOptionsText="no other analysis"
            optionKey={(option) => option.key}
            onPick={(option) => movePoints(store.getState(), option.key)}
        />
    );
}

export function PointPanel({ analysis, index }: { analysis: CoordinateAnalysis; index: number | null }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const point = index === null ? null : (analysis.points?.[index] ?? null);
    return (
        <PointEditor
            label={index === null ? `a new point of ${analysis.name}` : `point ${index + 1} of ${analysis.name}`}
            point={point}
            onSave={(next) => {
                if (savePoint(store.getState(), index, next as CoordinatePoint)) closePanel();
            }}
            onCancel={closePanel}
        />
    );
}

/** The space an analysis added to `table` starts with: that of the table's first analysis that states one. */
const tableSpace = (analyses: CoordinateAnalysis[], table: string) =>
    analyses.find((a) => a.table_id === table && a.coordinate_space)?.coordinate_space ?? '';

export function AddAnalysisPanel({ table }: { table: string }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const editors = editorsOf();
    const label = useReviewStore(
        (s) => (s.bundle.parsed_paper as ParsedPaperLayout).tables?.find((t) => t.table_id === table)?.label ?? table
    );
    const id = useId();
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [role, setRole] = useState(editors.roles?.kind === 'enum' ? editors.roles.options[0] : '');
    const [space, setSpace] = useState(() => tableSpace(currentAnalyses(store.getState().bundle), table));
    const save = (point: CoordinatePoint) => {
        if (!name.trim()) return setNameError('required');
        const fields = { name: name.trim(), role, ...(space ? { coordinate_space: space } : {}) };
        if (addAnalysis(store.getState(), table, fields, point)) closePanel();
    };
    return (
        <PointEditor
            label={`the first point of a new analysis in ${label}`}
            point={null}
            saveLabel="Add analysis"
            autoFocus={false}
            onSave={(point) => save(point as CoordinatePoint)}
            onCancel={closePanel}
        >
            {editors.name && (
                <ScalarField
                    id={`${id}-name`}
                    label="name"
                    spec={editors.name}
                    value={name}
                    error={nameError}
                    autoFocus
                    onChange={(next) => {
                        setName(next);
                        setNameError('');
                    }}
                />
            )}
            {editors.roles && (
                <ScalarField
                    id={`${id}-role`}
                    label="role"
                    spec={editors.roles}
                    value={role}
                    error=""
                    autoFocus={false}
                    onChange={setRole}
                />
            )}
            {editors.spaces && (
                <ScalarField
                    id={`${id}-space`}
                    label="coordinate space"
                    spec={editors.spaces}
                    value={space}
                    error=""
                    autoFocus={false}
                    optional
                    onChange={setSpace}
                />
            )}
        </PointEditor>
    );
}
