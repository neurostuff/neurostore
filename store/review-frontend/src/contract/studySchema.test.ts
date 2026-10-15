// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256Of, stripDescriptions, syncSchemas } from '../../scripts/sync-schemas.mjs';

const commitFile = path.join(__dirname, 'study-schema.commit');
const digestFile = path.join(__dirname, 'study-schema.sha256');

/** The digests recorded beside the commit, by file name, as `sha256sum` writes them. */
function digestsIn(file: string): Record<string, string> {
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    return Object.fromEntries(
        text
            .split('\n')
            .filter(Boolean)
            .map((line) => {
                const [digest, name] = line.split(/\s+/);
                return [name, digest];
            })
    );
}

const COPIES = [
    { name: 'extraction-record', id: 'https://neurostuff.org/schemas/neuroimaging-study-extraction' },
    { name: 'coordinate-parse', id: 'https://neurostuff.org/schemas/neuroimaging-paper-parse' },
];

it('the schema copies come from study_schema commit c60f05f', () => {
    const commit = existsSync(commitFile) ? readFileSync(commitFile, 'utf8').trim() : '';
    expect(commit).toBe('c60f05f25c48655622086f27ce85958188b79b6b');
});

describe.each(COPIES)('the $name schema copy', ({ name, id }) => {
    const schemaFile = path.join(__dirname, `${name}.schema.json`);
    const runtimeFile = path.join(__dirname, `${name}.runtime.schema.json`);

    it('is the schema it is named for', () => {
        const schema = existsSync(schemaFile) ? JSON.parse(readFileSync(schemaFile, 'utf8')) : {};
        expect(schema.$id).toBe(id);
    });

    it('has a runtime copy equal to the full copy without its descriptions', () => {
        const full = JSON.parse(readFileSync(schemaFile, 'utf8'));
        const runtime = existsSync(runtimeFile) ? JSON.parse(readFileSync(runtimeFile, 'utf8')) : null;
        expect(runtime).toEqual(stripDescriptions(full));
    });

    it('records the sha256 of the full copy beside the commit, so an edited copy fails', () => {
        expect(digestsIn(digestFile)[`${name}.schema.json`]).toBe(sha256Of(readFileSync(schemaFile, 'utf8')));
    });
});

describe('syncSchemas', () => {
    const schemaOf = (id: string) => ({
        $id: id,
        description: 'top',
        $defs: { Thing: { description: 'a thing', properties: { description: { type: 'string' } } } },
    });

    it('copies both schemas from a checkout, with their runtime copies, digests and the commit', () => {
        const source = mkdtempSync(path.join(tmpdir(), 'study-schema-'));
        const exported = path.join(source, 'src', 'study_schema', 'jsonschema');
        mkdirSync(exported, { recursive: true });
        const texts = Object.fromEntries(
            COPIES.map(({ name, id }) => [name, `${JSON.stringify(schemaOf(id), null, 2)}\n`])
        );
        for (const { name } of COPIES) writeFileSync(path.join(exported, `${name}.schema.json`), texts[name]);
        const into = mkdtempSync(path.join(tmpdir(), 'contract-'));

        syncSchemas(source, 'abc123', into);

        expect(readdirSync(into).sort()).toEqual([
            'coordinate-parse.runtime.schema.json',
            'coordinate-parse.schema.json',
            'extraction-record.runtime.schema.json',
            'extraction-record.schema.json',
            'study-schema.commit',
            'study-schema.sha256',
        ]);
        expect(readFileSync(path.join(into, 'study-schema.commit'), 'utf8')).toBe('abc123\n');
        const digests = digestsIn(path.join(into, 'study-schema.sha256'));
        for (const { name, id } of COPIES) {
            expect(readFileSync(path.join(into, `${name}.schema.json`), 'utf8')).toBe(texts[name]);
            expect(JSON.parse(readFileSync(path.join(into, `${name}.runtime.schema.json`), 'utf8'))).toEqual({
                $id: id,
                $defs: { Thing: { properties: { description: { type: 'string' } } } },
            });
            expect(digests[`${name}.schema.json`]).toBe(sha256Of(texts[name]));
        }
    });
});
