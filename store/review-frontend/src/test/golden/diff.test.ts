import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../../contract/generated/review-bundle';
import { currentAnalyses, parseOf } from '../../model/coordinates';
import { isChange, visibleItems, type DiffItem } from '../../model/diff';
import { targetKey } from '../../model/targetKey';
import { changeGroups, targetLabeller } from '../../review/summary';
import { selectDiff, selectOriginalIndex } from '../../store/diffSelectors';
import { createReviewStores } from '../../store/context';

const read = (name: string) => JSON.parse(readFileSync(path.resolve(__dirname, name), 'utf8'));
const bundle: ReviewBundle = read('diff-bundle.json');
const verdicts: { key: string; verdict: string; replaced_by?: string[] }[] = read('diff-verdicts.json');

const store = createReviewStores(bundle);
const state = store.session.getState();
const diff = selectDiff(state);
const changed = diff.items.filter((item) => isChange(item.status));
const keysOf = (items: DiffItem[]) => items.map((item) => item.key).sort();

/** The targets the review's ops touched, as the diff keys them. */
const touched = bundle.ops.flatMap(({ op, after }) => {
    switch (op.type) {
        case 'set_value':
        case 'link':
        case 'unlink':
            return [targetKey(op.target)];
        case 'create_entity':
            return [`entity:${(after as { entity: { local_id: string } }).entity.local_id}`];
        case 'coordinate':
        case 'verdict':
            return [targetKey(op.target)];
        default:
            return [];
    }
});

describe('the diff of the golden review, built by the backend, against its original', () => {
    it('changes the slot, the entity and the links the op log touched, and the entities that own them', () => {
        const items = changed.filter((item) => item.kind !== 'analysis');
        expect(keysOf(items.filter((item) => item.kind !== 'entity'))).toEqual(
            touched.filter((key) => key.startsWith('slot:') || key.startsWith('relationship:')).sort()
        );
        expect(keysOf(items.filter((item) => item.kind === 'entity'))).toEqual([
            'entity:an_1',
            'entity:grp_a',
            'entity:grp_b',
            'entity:grp_c',
        ]);
        expect(diff.byKey.get('entity:grp_c')?.status).toBe('added');
        expect(diff.byKey.get('slot:grp_a:age_mean')).toMatchObject({
            status: 'changed',
            before: { value: 34.2 },
            after: { value: 35 },
        });
        expect(diff.byKey.get('relationship:grp_b:diagnostic_instrument:asm_1')?.status).toBe('added');
        expect(diff.byKey.get('relationship:an_1:tasks:tsk_1')?.status).toBe('removed');
    });

    it('changes the coordinate analyses the op log touched, and no product of the split as added', () => {
        const analyses = changed.filter((item) => item.kind === 'analysis');
        const originals = analyses.map((item) => item.key).sort();
        expect(originals).toEqual(touched.filter((key) => key.startsWith('coordinate_analysis:')).sort());
        expect(analyses.filter((item) => item.status === 'added')).toEqual([]);
    });

    it('matches each analysis’s change to the verdict the export derives from the revision and provenance', () => {
        const { parse } = parseOf(bundle);
        expect(verdicts.map((v) => v.key)).toEqual(parse.analyses!.map((a) => a.key));
        for (const verdict of verdicts) {
            const item = diff.byKey.get(`coordinate_analysis:${verdict.key}`);
            if (item?.kind !== 'analysis') throw new Error(`no item for ${verdict.key}`);
            const expected = verdict.verdict === 'omit' ? ['omit', 'reject'] : [verdict.verdict];
            expect(expected).toContain(item.change);
            expect(item.status).toBe(
                verdict.verdict === 'accept' ? 'same' : verdict.verdict === 'omit' ? 'removed' : 'changed'
            );
            expect(item.after.map((a) => a.key)).toEqual(
                verdict.verdict === 'omit' ? [] : (verdict.replaced_by ?? [verdict.key])
            );
        }
        const seed = verdicts.find((v) => v.verdict === 'omit')!;
        expect(diff.byKey.get(`coordinate_analysis:${seed.key}`)).toMatchObject({ change: 'reject' });
    });

    it('counts what changed as the op log did', () => {
        const label = targetLabeller(state.index, selectOriginalIndex(state), currentAnalyses(bundle));
        const groups = changeGroups(visibleItems(diff, true), label);
        expect(groups.map((g) => [g.label, g.items.length])).toEqual([
            ['slots edited', 1],
            ['entities added', 1],
            ['links added', 1],
            ['links removed', 1],
            ['coordinate analyses split', 1],
            ['coordinate analyses rejected', 1],
        ]);
    });
});
