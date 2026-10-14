// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateTypes, outputDir } from '../../scripts/gen-types.mjs';

describe('generated contract types', () => {
    it('match the schemas they are generated from', async () => {
        const generated = await generateTypes();
        expect(Object.keys(generated).sort()).toEqual(['review-bundle.ts', 'review-ops.ts']);
        for (const [file, content] of Object.entries(generated)) {
            expect(readFileSync(path.join(outputDir, file), 'utf8')).toBe(content);
        }
    });
});
