import { readFileSync } from 'node:fs';
import path from 'node:path';
import { coordinateBundle } from './coordinates';

it('the end-to-end paper is the coordinate test paper, its review not yet started', () => {
    const file = path.resolve(__dirname, '../../e2e/fixtures/P1.bundle.json');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(coordinateBundle({ review: null }));
});
