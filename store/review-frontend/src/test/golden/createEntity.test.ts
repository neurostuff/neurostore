import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import type { ReviewBundle } from '../../contract/generated/review-bundle';
import type { CreateEntityOp, Op } from '../../contract/generated/review-ops';
import { createSibling, siblingClasses } from '../../inspector/actions';
import type { Json } from '../../model/paths';
import { extractionSchema, listClassesAt, skeletonOf } from '../../model/schema';
import { createReviewStores } from '../../store/reviewStores';
import { hasFixture, loadFixture } from '../bundles';
import { problemsWithCreated, recordProblems } from '../recordProblems';

const golden: ReviewBundle = JSON.parse(readFileSync(path.resolve(__dirname, 'bundle.json'), 'utf8'));
/** The create_entity New entity sends beside the golden analysis, which the backend's tests apply. */
const CREATE_ANALYSIS = path.resolve(__dirname, 'create-analysis.json');

const isEntityClass = (name: string) =>
    'local_id' in (((extractionSchema().$defs as Json)[name] as Json).properties as Json);

/** The study's entity lists, by path, and the classes each holds. */
const studyLists = () =>
    Object.keys((extractionSchema().properties ?? {}) as Json).flatMap((list) => {
        const classes = listClassesAt(extractionSchema(), 'Study', list, {}).filter(isEntityClass);
        return classes.length ? [{ list, classes }] : [];
    });

/** The golden bundle with one entity in each study list it has none in, so that every list has a sibling to focus. */
function seeded(bundle: ReviewBundle): ReviewBundle {
    const record = bundle.record as Json;
    const empty = studyLists().filter(({ list }) => !(record[list] as unknown[] | undefined)?.length);
    const seeds = empty.map(({ list, classes: [cls] }) => ({
        list,
        cls,
        item: { local_id: `seed_${list}`, ...skeletonOf(extractionSchema(), cls).entity },
    }));
    return {
        ...bundle,
        record: { ...record, ...Object.fromEntries(seeds.map(({ list, item }) => [list, [item]])) },
        entities: [
            ...bundle.entities,
            ...seeds.map(({ list, cls, item }) => ({
                local_id: item.local_id,
                entity_class: cls,
                schema_class: cls,
                parent: 'study',
                list_path: list,
            })),
        ],
    };
}

const fixtureIds = ['22fv2dADxHqR', '24syuoHkxfeu', '25Czf8TcaxDS', '2KTUQPrgtEke'];
const bundles: [string, ReviewBundle][] = [
    ['the golden record', seeded(golden)],
    ...fixtureIds.filter(hasFixture).map((id): [string, ReviewBundle] => [id, loadFixture(id)]),
];

describe('a new entity beside each entity in a list', () => {
    it('is offered in every list of the golden schema, the nested ones too, in each class the list holds', () => {
        const stores = createReviewStores(seeded(golden));
        const { bundle } = stores.session.getState();
        const offered = bundle.entities.filter((row) => siblingClasses(stores.session.getState(), row.local_id).length);
        const classes = new Set(
            offered.flatMap((row) => siblingClasses(stores.session.getState(), row.local_id).map((c) => c.name))
        );
        const lists = new Set(offered.map((row) => row.list_path));
        expect([...new Set(studyLists().flatMap(({ classes }) => classes))].filter((c) => !classes.has(c))).toEqual([]);
        expect(
            [...studyLists().map(({ list }) => list), 'conditions', 'terms', 'design.arms', 'design.timepoints'].filter(
                (list) => !lists.has(list)
            )
        ).toEqual([]);
    });

    it.each(bundles)(
        'validates against the extraction-record schema, in each class offered, in %s',
        { timeout: 30_000 },
        (_, bundle) => {
            expect(recordProblems(bundle.record)).toEqual([]);
            const stores = createReviewStores(bundle);
            const sent: Op[] = [];
            stores.session.setState({ emit: vi.fn((op: Op) => sent.push(op) > 0) });
            const failures = bundle.entities.flatMap((row) => {
                const documents = stores.session.getState();
                stores.view.getState().focusEntity(row.local_id);
                return siblingClasses(documents, row.local_id).flatMap(({ name }) => {
                    sent.length = 0;
                    if (!createSibling(stores, name)) return [`${row.local_id} → ${name}: nothing sent`];
                    const op = sent[0] as CreateEntityOp;
                    const problems = problemsWithCreated(documents.record as Json, op);
                    return problems.map((problem) => `${row.local_id} → ${name}: ${problem}`);
                });
            });
            expect(failures).toEqual([]);
        }
    );

    it('takes each reference from the only entity of its class, and the first branch, when the sibling has neither', () => {
        const record = golden.record as Json;
        const [analysis, ...rest] = record.analyses as Json[];
        const bare = Object.fromEntries(
            Object.entries(analysis).filter(([key]) => !['measure', 'model_estimation', 'details'].includes(key))
        );
        const stores = createReviewStores({ ...golden, record: { ...record, analyses: [bare, ...rest] } });
        const sent: Op[] = [];
        stores.session.setState({ emit: vi.fn((op: Op) => sent.push(op) > 0) });
        stores.view.getState().focusEntity(analysis.local_id as string);
        expect(createSibling(stores, 'Analysis')).toBe(true);
        const op = sent[0] as CreateEntityOp;
        expect(op.entity).toMatchObject({
            measure: (record.measures as Json[])[0].local_id,
            model_estimation: (record.model_estimations as Json[])[0].local_id,
            details: { details_type: 'MassUnivariateDetails' },
        });
        expect(problemsWithCreated(record, op)).toEqual([]);
    });

    it('beside the golden analysis is the op create-analysis.json holds; regenerate with UPDATE_GOLDEN=1', () => {
        const stores = createReviewStores(golden);
        const sent: Op[] = [];
        stores.session.setState({ emit: vi.fn((op: Op) => sent.push(op) > 0) });
        stores.view.getState().focusEntity('an_1');
        expect(createSibling(stores, 'Analysis')).toBe(true);
        const rendered = JSON.stringify({ ...sent[0], client_op_id: 'frontend-create-analysis' }, null, 2) + '\n';
        if (process.env.UPDATE_GOLDEN === '1') writeFileSync(CREATE_ANALYSIS, rendered);
        expect(existsSync(CREATE_ANALYSIS)).toBe(true);
        expect(readFileSync(CREATE_ANALYSIS, 'utf8')).toBe(rendered);
    });
});
