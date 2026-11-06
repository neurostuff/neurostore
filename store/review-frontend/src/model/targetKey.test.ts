import bundleSchema from '../../../backend/neurostore/review/schema/review-bundle.schema.json';
import { targetKey } from './targetKey';

const pattern = new RegExp(bundleSchema.$defs.TargetKey.pattern);

describe('targetKey', () => {
    it.each([
        [{ kind: 'slot', entity: 'a_1', path: 'groups[#0].n' }, 'slot:a_1:groups[#0].n'],
        [{ kind: 'entity', entity: 'grp_a' }, 'entity:grp_a'],
        [
            { kind: 'relationship', entity: 'a_1', path: 'measure', target_entity: 'mea_1' },
            'relationship:a_1:measure:mea_1',
        ],
        [
            { kind: 'coordinate_analysis', analysis_key: 'analysis#0123456789abcdef' },
            'coordinate_analysis:analysis#0123456789abcdef',
        ],
        [{ kind: 'paper' }, 'paper'],
    ] as const)('writes %o as %s, a key the bundle schema accepts', (target, key) => {
        expect(targetKey(target)).toBe(key);
        expect(key).toMatch(pattern);
    });
});
