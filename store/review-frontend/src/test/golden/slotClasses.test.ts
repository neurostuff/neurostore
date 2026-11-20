import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Json } from '../../model/paths';
import { walkClasses, type ClassRow } from './schemaWalk';

interface Section {
    record: Json;
    classes: ClassRow[];
    wrappers: ClassRow[];
}

const GOLDEN: Record<string, Section> = JSON.parse(readFileSync(path.resolve(__dirname, 'slot-classes.json'), 'utf8'));

const key = (row: ClassRow) => `${row.entity} ${row.path || '(entity)'}`;

/** One line per row where the walk and the backend disagree, naming the row. */
function mismatches(expected: ClassRow[], actual: ClassRow[]): string[] {
    const got = new Map(actual.map((row) => [key(row), row.class]));
    const want = new Map(expected.map((row) => [key(row), row.class]));
    return [
        ...[...want].flatMap(([row, cls]) =>
            got.get(row) === cls ? [] : [`${row}: backend wrote ${cls}, the walk gives ${got.get(row) ?? 'no row'}`]
        ),
        ...[...got].flatMap(([row, cls]) =>
            want.has(row) ? [] : [`${row}: the walk gives ${cls}, the backend wrote no row`]
        ),
    ];
}

describe.each(Object.keys(GOLDEN))('the schema walk of the %s record', (name) => {
    const section = GOLDEN[name];
    const walked = walkClasses(section.record);

    it('gives every entity and nested object the schema class the backend wrote', () => {
        expect(mismatches(section.classes, walked.classes)).toEqual([]);
    });

    it('gives every value wrapper its def name, the same rows the backend wrote', () => {
        expect(mismatches(section.wrappers, walked.wrappers)).toEqual([]);
    });
});
