import { List, ListItem, Stack, Typography } from '@mui/material';
import { useId, useMemo, useState } from 'react';
import type { CoordinateOp } from '../contract/generated/review-ops';
import { ConfirmDialog, DanglingList, PickPanel } from '../inspector/panels';
import { panelKeys } from '../inspector/panelKeys';
import { ScalarField } from '../inspector/SlotEditor';
import {
    currentAnalyses,
    NULL_OUTCOME,
    printedCoordinates,
    RECORD_OUTCOME,
    RECORD_SCOPE,
    type CoordinateAnalysis,
    type CoordinatePoint,
} from '../model/coordinates';
import { useReviewStores, useSession, useView } from '../store/context';
import type { ParsedPaperLayout } from '../model/layout';
import {
    addAnalysis,
    editAnalysis,
    type AnalysisEdit,
    type AnalysisSource,
    mergeAnalyses,
    mergePreview,
    movePoints,
    relabelAnalysis,
} from './actions';
import { mergeSet, moveTargets, movingPoints } from './availability';
import { PointEditor } from './PointEditor';
import { analysisEditors, recordAnalysisChoices } from './schema';

type Role = NonNullable<CoordinateOp['role']>;

type AnalysisField = 'name' | 'space' | 'role';

/**
 * A form for those of an analysis's name, coordinate space and role that `fields` lists, the first focused; Enter
 * hands `save` the edit, and the form closes once it is sent.
 */
function AnalysisForm({
    analysis,
    fields,
    label,
    save,
}: {
    analysis: CoordinateAnalysis;
    fields: AnalysisField[];
    label: string;
    save: (edit: AnalysisEdit) => boolean;
}) {
    const closePanel = useView((s) => s.closePanel);
    const editors = analysisEditors();
    const id = useId();
    const [name, setName] = useState(analysis.name);
    const [nameError, setNameError] = useState('');
    const [space, setSpace] = useState(analysis.coordinate_space ?? '');
    const [role, setRole] = useState(analysis.role);
    const submit = () => {
        if (!name.trim()) return setNameError('required');
        if (save({ name: name.trim(), role, coordinate_space: space || null })) closePanel();
    };
    const first = (field: AnalysisField) => fields[0] === field;
    return (
        <Stack role="group" aria-label={label} spacing={1.5} sx={{ py: 1 }} onKeyDown={panelKeys(submit, closePanel)}>
            {fields.includes('name') && editors.name && (
                <ScalarField
                    id={`${id}-name`}
                    label="name"
                    spec={editors.name}
                    value={name}
                    error={nameError}
                    autoFocus={first('name')}
                    onChange={(next) => {
                        setName(next);
                        setNameError('');
                    }}
                />
            )}
            {fields.includes('space') && editors.spaces && (
                <ScalarField
                    id={`${id}-space`}
                    label="coordinate space"
                    spec={editors.spaces}
                    value={space}
                    error=""
                    autoFocus={first('space')}
                    optional
                    onChange={setSpace}
                />
            )}
            {fields.includes('role') && editors.roles && (
                <ScalarField
                    id={`${id}-role`}
                    label="role"
                    spec={editors.roles}
                    value={role}
                    error=""
                    autoFocus={first('role')}
                    onChange={setRole}
                />
            )}
        </Stack>
    );
}

/** Change role: the Edit analysis form with only the role, sent as a relabel. */
export function RelabelPanel({ analysis }: { analysis: CoordinateAnalysis }) {
    const stores = useReviewStores();
    return (
        <AnalysisForm
            analysis={analysis}
            fields={['role']}
            label={`change the role of ${analysis.name}`}
            save={({ role }) => role === analysis.role || relabelAnalysis(stores, role as Role)}
        />
    );
}

export function EditAnalysisPanel({ analysis }: { analysis: CoordinateAnalysis }) {
    const stores = useReviewStores();
    return (
        <AnalysisForm
            analysis={analysis}
            fields={['name', 'space', 'role']}
            label={`edit analysis ${analysis.name}`}
            save={(edit) => editAnalysis(stores, analysis.key, edit)}
        />
    );
}

export function MergeDialog() {
    const stores = useReviewStores();
    const bundle = useSession((s) => s.bundle);
    const index = useSession((s) => s.index);
    const coordinates = useView((s) => s.coordinates);
    const merging = useView((s) => s.merging);
    const [into, ...others] = useMemo(
        () => mergeSet({ bundle }, { coordinates, merging }),
        [bundle, coordinates, merging]
    );
    const { removed, dangling } = useMemo(
        () => mergePreview({ bundle, index }, { coordinates, merging }),
        [bundle, index, coordinates, merging]
    );
    return (
        <ConfirmDialog
            title={`Merge ${others.length + 1} analyses into ${into.name}?`}
            confirmLabel="Merge"
            onConfirm={() => mergeAnalyses(stores)}
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
    const stores = useReviewStores();
    const bundle = useSession((s) => s.bundle);
    const coordinates = useView((s) => s.coordinates);
    const options = useMemo(() => moveTargets({ bundle }, { coordinates }), [bundle, coordinates]);
    const count = movingPoints({ coordinates }).length;
    return (
        <PickPanel
            options={options}
            label={`move ${count} point${count === 1 ? '' : 's'} to`}
            noOptionsText="no other analysis"
            optionKey={(option) => option.key}
            onPick={(option) => movePoints(stores, option.key)}
        />
    );
}

/** The space an analysis added from `source` starts with: that of the first analysis of its table, or of the paper, that states one. */
function startingSpace(analyses: CoordinateAnalysis[], source: AnalysisSource) {
    const from = 'table' in source ? analyses.filter((a) => a.table_id === source.table) : analyses;
    return from.find((a) => a.coordinate_space)?.coordinate_space ?? '';
}

const NULL_SWITCH = { kind: 'boolean' } as const;

export function AddAnalysisPanel({ source }: { source: AnalysisSource }) {
    const stores = useReviewStores();
    const closePanel = useView((s) => s.closePanel);
    const editors = analysisEditors();
    const label = useSession((s) =>
        'table' in source
            ? `in ${(s.bundle.parsed_paper as ParsedPaperLayout).tables?.find((t) => t.table_id === source.table)?.label ?? source.table}`
            : 'from the selected text'
    );
    const [point] = useState(() => {
        if ('table' in source) return null;
        const coordinates = printedCoordinates(stores.session.getState().bundle.text.slice(...source.span));
        return coordinates ? { coordinates } : null;
    });
    const id = useId();
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [role, setRole] = useState(editors.roles?.kind === 'enum' ? editors.roles.options[0] : '');
    const [space, setSpace] = useState(() => startingSpace(currentAnalyses(stores.session.getState().bundle), source));
    const [isNull, setNull] = useState(false);
    const [scope, setScope] = useState('');
    const scopes = useSession((s) =>
        recordAnalysisChoices({ entities: s.bundle.entities, record: s.record }, RECORD_SCOPE)
    );
    const save = (next: CoordinatePoint | null) => {
        if (!name.trim()) return setNameError('required');
        const fields = { name: name.trim(), role, ...(space ? { coordinate_space: space } : {}) };
        const record = { ...(isNull && { [RECORD_OUTCOME]: NULL_OUTCOME }), ...(scope && { [RECORD_SCOPE]: scope }) };
        if (addAnalysis(stores, source, fields, isNull ? null : next, record)) closePanel();
    };
    return (
        <PointEditor
            label={`the first point of a new analysis ${label}`}
            point={point}
            saveLabel="Add analysis"
            autoFocus={false}
            onSave={(next) => save(next as CoordinatePoint | null)}
            onCancel={closePanel}
            withoutPoint={isNull}
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
            {scopes && (
                <ScalarField
                    id={`${id}-scope`}
                    label="spatial scope"
                    spec={scopes}
                    value={scope}
                    error=""
                    autoFocus={false}
                    optional
                    onChange={setScope}
                />
            )}
            <ScalarField
                id={`${id}-null`}
                label="no significant result: no points"
                spec={NULL_SWITCH}
                value={String(isNull)}
                error=""
                autoFocus={false}
                onChange={(next) => setNull(next === 'true')}
            />
        </PointEditor>
    );
}
