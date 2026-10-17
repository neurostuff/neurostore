import { buildRecordIndex } from '../model/record';
import { slotKey } from '../model/targetKey';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { explain } from './explainProblem';

const TEXT = 'Twenty patients and twenty controls.';
const bundle = makeBundle(
    {
        groups: [
            { local_id: 'grp_a', name: ev('Patients'), acquired_count: ev(20), age_mean: ev(31) },
            { local_id: 'grp_b' },
        ],
    },
    TEXT,
    { entities: entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups')) }
);
const index = buildRecordIndex(bundle);
const explainOn = (problem: string) => explain(problem, index, bundle.record as Record<string, unknown>);

describe('explain', () => {
    it('names the card and slot a refusal is about, and drops the schema path', () => {
        expect(explainOn('extraction-record /groups/0/acquired_count: too high')).toEqual({
            message: 'too high',
            label: 'Patients · acquired_count',
            focus: { entity: 'grp_a', slot: slotKey('grp_a', 'acquired_count') },
        });
    });

    it('names an unnamed card by its local id, as the card is named', () => {
        expect(explainOn('extraction-record /groups/1: value missing')).toEqual({
            message: 'value missing',
            label: 'grp_b',
            focus: { entity: 'grp_b' },
        });
    });

    it('focuses the slot a value refusal from the backend names, dropping the wrapper steps', () => {
        expect(explainOn("extraction-record /groups/0/age_mean/value: 'old' is not of type 'number', 'null'")).toEqual({
            message: "'old' is not of type 'number', 'null'",
            label: 'Patients · age_mean',
            focus: { entity: 'grp_a', slot: slotKey('grp_a', 'age_mean') },
        });
    });

    it('focuses the slot an evidence refusal names, dropping the evidence steps', () => {
        expect(explainOn('extraction-record /groups/0/age_mean/evidence/0/sets/0/spans/0: outside the paper')).toEqual({
            message: 'outside the paper',
            label: 'Patients · age_mean',
            focus: { entity: 'grp_a', slot: slotKey('grp_a', 'age_mean') },
        });
    });

    it('leaves a message without a schema path as it is', () => {
        expect(explainOn('the batch is too large')).toEqual({ message: 'the batch is too large' });
    });

    it('never shows a path it cannot place on a card', () => {
        const explained = explainOn('extraction-record /elsewhere/0/x: bad');
        expect(explained.message).toBe('bad');
        expect(explained.label).not.toContain('/');
    });
});
