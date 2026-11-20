import { readFileSync } from 'node:fs';
import path from 'node:path';
import { naiveBundle } from './naiveBundle';
import { validateBundle } from './schemas';

it('the end-to-end naive-user paper is the synthetic one, a valid bundle', () => {
    const file = path.resolve(__dirname, '../../e2e/fixtures/P2.bundle.json');
    const bundle = JSON.parse(readFileSync(file, 'utf8'));
    expect(bundle).toEqual(naiveBundle());
    expect(validateBundle(bundle)).toBe(true);
});
