import type { AnyTarget, Op } from '../contract/generated/review-ops';
import type { CoordinateAnalysis } from '../model/coordinates';
import { diffTarget, isChange, type DiffItem } from '../model/diff';
import type { RecordIndex } from '../model/record';
import { slotKey, targetKey } from '../model/targetKey';
import { slotLabel } from '../model/labels';
import type { ProvenanceMap } from '../model/applyOp';
import { stepTargets, type StepState } from '../model/guided';
import { STEPS } from '../model/steps';

/** One line of the summary: what it names, and the target that focuses it, if the review still has it. */
export interface SummaryItem {
    key: string;
    label: string;
    target: AnyTarget | null;
}

export interface SummaryGroup {
    label: string;
    items: SummaryItem[];
}

export interface SummaryNote extends SummaryItem {
    note: string;
}

/** Names targets by the review's entities, else the original's, and coordinate analyses by name. */
export function targetLabeller(review: RecordIndex, original: RecordIndex, analyses: CoordinateAnalysis[]) {
    const entity = (id: string) => review.entity(id)?.name ?? original.entity(id)?.name ?? id;
    const slot = (target: { entity: string; path: string }) =>
        slotLabel(review.slot(slotKey(target.entity, target.path)) ? review : original, target);
    const named = new Map(analyses.map((a) => [a.key, a.name]));
    return (target: AnyTarget): string => {
        switch (target.kind) {
            case 'entity':
                return entity(target.entity);
            case 'slot':
                return `${entity(target.entity)} · ${slot(target)}`;
            case 'relationship':
                return `${entity(target.entity)} · ${slot(target)} → ${entity(target.target_entity)}`;
            case 'coordinate_analysis':
                return named.get(target.analysis_key) ?? target.analysis_key;
            case 'paper':
                return 'the paper';
        }
    };
}

type Label = ReturnType<typeof targetLabeller>;

const CHANGE_KINDS: [string, (item: DiffItem) => boolean][] = [
    ['slots edited', (i) => i.kind === 'slot' && isChange(i.status) && i.status !== 'rejected'],
    ['entities added', (i) => i.kind === 'entity' && i.status === 'added'],
    ['entities removed', (i) => i.kind === 'entity' && i.status === 'removed'],
    ['links added', (i) => i.kind === 'relationship' && i.status === 'added'],
    ['links removed', (i) => i.kind === 'relationship' && i.status === 'removed'],
    ['coordinate analyses split', (i) => i.kind === 'analysis' && i.change === 'split'],
    ['coordinate analyses merged', (i) => i.kind === 'analysis' && i.change === 'merge'],
    [
        'coordinate analyses edited',
        (i) => i.kind === 'analysis' && i.status === 'changed' && (i.change === 'relabel' || i.change === 'edit'),
    ],
    ['coordinate analyses rejected', (i) => i.kind === 'analysis' && (i.change === 'omit' || i.change === 'reject')],
    ['coordinate analyses added', (i) => i.kind === 'analysis' && i.status === 'added'],
    ['rejected', (i) => i.kind !== 'analysis' && i.status === 'rejected'],
];

function itemLabel(item: DiffItem, label: Label): string {
    switch (item.kind) {
        case 'entity':
            return label({ kind: 'entity', entity: item.entity });
        case 'slot':
            return label({ kind: 'slot', entity: item.entity, path: item.path });
        case 'relationship':
            return label({ kind: 'relationship', entity: item.entity, path: item.path, target_entity: item.target });
        case 'analysis':
            return (item.before ?? item.after[0])?.name ?? item.key;
    }
}

/** What changed against the original, by kind; kinds with nothing are left out. */
export function changeGroups(items: DiffItem[], label: Label): SummaryGroup[] {
    return CHANGE_KINDS.map(([kind, matches]) => ({
        label: kind,
        items: items
            .filter(matches)
            .map((item) => ({ key: item.key, label: itemLabel(item, label), target: diffTarget(item) })),
    })).filter((group) => group.items.length > 0);
}

/** The notes of the op log, in order: note ops and verdicts given with a note. */
export function openNotes(ops: Op[], label: Label): SummaryNote[] {
    return ops.flatMap((op, i): SummaryNote[] =>
        (op.type === 'note' || op.type === 'verdict') && op.note
            ? [{ key: `${i}:${targetKey(op.target)}`, label: label(op.target), target: op.target, note: op.note }]
            : []
    );
}

/** The items no person has judged yet, by guided step; steps with none are left out. */
export function unreviewedGroups(s: StepState & { provenance: ProvenanceMap }, label: Label): SummaryGroup[] {
    return STEPS.flatMap((step): SummaryGroup[] => {
        const items = (stepTargets(s, step.id) ?? [])
            .filter((target) => s.provenance[targetKey(target)] === undefined)
            .map((target) => ({ key: targetKey(target), label: label(target), target }));
        return items.length ? [{ label: step.label, items }] : [];
    });
}
