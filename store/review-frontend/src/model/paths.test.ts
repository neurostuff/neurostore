import { describe, expect, it } from 'vitest';
import { parsePath, readPath } from './paths';

describe('field paths', () => {
    it('take attribute names of the schema pattern and nothing else', () => {
        expect(parsePath('groups[#1].age_mean')).toEqual(['groups', 1, 'age_mean']);
        expect(() => parsePath('age-mean')).toThrow("malformed field path 'age-mean'");
        expect(() => parsePath('1age')).toThrow("malformed field path '1age'");
    });

    it('name a keyed selector as one the server applies, not as malformed', () => {
        const thrown = (() => {
            try {
                readPath({ groups: [] }, 'groups[name=x,role=y]');
            } catch (error) {
                return error;
            }
        })();
        expect(thrown).toMatchObject({ name: 'NotLocal', message: expect.stringContaining('the server applies') });
    });
});
