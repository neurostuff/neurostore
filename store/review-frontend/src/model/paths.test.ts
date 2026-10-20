import { describe, expect, it } from 'vitest';
import { leafOf, listOf, parsePath, readPath } from './paths';

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

describe('a path’s list and leaf', () => {
    it('name the first list a path goes through, its item and the rest', () => {
        expect(listOf('groups[#1].n')).toEqual({ list: 'groups', item: 'groups[#1]', field: 'n' });
        expect(listOf('details.classes[#0].label')).toEqual({
            list: 'details.classes',
            item: 'details.classes[#0]',
            field: 'label',
        });
        expect(listOf('age_mean')).toBeUndefined();
    });

    it('take a path’s last attribute, without its places', () => {
        expect(leafOf('groups[#1].n')).toBe('n');
        expect(leafOf('effect.statistic.family')).toBe('family');
    });
});
