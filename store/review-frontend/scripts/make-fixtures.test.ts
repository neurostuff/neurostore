// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hasFixture, loadFixture } from '../src/test/bundles';
import { validateBundle } from '../src/test/schemas';

const script = path.resolve(__dirname, 'make-fixtures.py');
const STUB_ENTITIES = `
def index_rows(record):
    rows = [{"local_id": "study", "entity_class": "Study", "schema_class": "Study", "parent": None, "list_path": None}]
    return rows + [
        {"local_id": a["local_id"], "entity_class": "Analysis", "schema_class": "Analysis",
         "parent": "study", "list_path": "analyses"}
        for a in record["analyses"]
    ]
`;
const STUB_BUNDLE = `
def hidden(record, coordinate_parse):
    return {"analyses": [], "entities": []}
`;
const KEPT = 'analysis#0123456789abcdef';
const TEXT = 'A Title\r\n## Methods \nCafé — 3 T scanner.\n';

function writeJson(file: string, value: unknown) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
}

function stubBackend() {
    const root = mkdtempSync(path.join(tmpdir(), 'review-backend-'));
    const review = path.join(root, 'neurostore', 'review');
    mkdirSync(review, { recursive: true });
    writeFileSync(path.join(root, 'neurostore', '__init__.py'), '');
    writeFileSync(path.join(review, '__init__.py'), '');
    writeFileSync(path.join(review, 'entities.py'), STUB_ENTITIES);
    writeFileSync(path.join(review, 'bundle.py'), STUB_BUNDLE);
    return root;
}

function makeLayout() {
    const root = mkdtempSync(path.join(tmpdir(), 'review-layout-'));
    const paper = path.join(root, 'corpus', 'P1');
    writeJson(path.join(paper, 'parse', 'parsed_paper.json'), {
        header: {
            schema_version: '0.6.0',
            article_id: 'art-P1',
            identifiers: { neurostore_base_study_id: 'BS1' },
        },
        text_path: 'processed/text.txt',
        bibliography: { title: 'A Title' },
    });
    writeJson(path.join(paper, 'parse', 'coordinate_parse.json'), { analyses: [{ key: KEPT }] });
    mkdirSync(path.join(paper, 'processed'));
    writeFileSync(path.join(paper, 'processed', 'text.txt'), TEXT);
    writeJson(path.join(root, 'run', 'records', 'P1.extraction.json'), {
        local_id: 'P1',
        extraction_metadata: { extractor_version: 'pondie-1' },
        analyses: [
            { local_id: 'a_kept', source_table_analysis: { extraction_status: 'extracted', value: KEPT } },
            { local_id: 'a_missing' },
            { local_id: 'a_unreported', source_table_analysis: { extraction_status: 'not_reported' } },
            {
                local_id: 'a_unknown',
                source_table_analysis: { extraction_status: 'extracted', value: 'analysis#ffffffffffffffff' },
            },
        ],
    });
    return root;
}

describe('make-fixtures.py', () => {
    const layout = makeLayout();
    const out = mkdtempSync(path.join(tmpdir(), 'review-fixtures-'));
    execFileSync('python3', ['-s', script, layout, out, 'P1'], { env: { ...process.env, PYTHONPATH: stubBackend() } });
    const bundle = JSON.parse(readFileSync(path.join(out, 'P1.bundle.json'), 'utf8'));

    it('writes a bundle that conforms to the bundle schema', () => {
        const valid = validateBundle(bundle);
        expect(validateBundle.errors ?? []).toEqual([]);
        expect(valid).toBe(true);
    });

    it('carries the paper text unchanged and an upload source labelled with the title', () => {
        expect(bundle.text).toBe(TEXT);
        expect(bundle.source).toEqual({
            id: 'P1',
            base_study_id: 'BS1',
            label: 'A Title',
            origin: 'upload',
            text_sha256: createHash('sha256').update(TEXT, 'utf8').digest('hex'),
            schema_versions: { paper_parse: '0.6.0', extraction: '' },
        });
        expect(bundle).toMatchObject({ review: null, ops: [], reviewers: [], coordinate_revision: null });
    });

    it('carries the backend’s entity index of the record', () => {
        expect(bundle.entities.map((e: { local_id: string }) => e.local_id)).toEqual([
            'study',
            'a_kept',
            'a_missing',
            'a_unreported',
            'a_unknown',
        ]);
    });

    it('lists the bundles in index.json', () => {
        expect(JSON.parse(readFileSync(path.join(out, 'index.json'), 'utf8'))).toEqual([
            { id: 'P1', label: 'A Title' },
        ]);
    });

    it.each(['22fv2dADxHqR', '25Czf8TcaxDS'].filter(hasFixture))('wrote the fixture %s to the bundle schema', (id) => {
        validateBundle(loadFixture(id));
        expect(validateBundle.errors ?? []).toEqual([]);
    });
});

describe('make-fixtures.py without a required header field', () => {
    it.each([
        ['schema_version', 'missing'],
        ['article_id', 'missing'],
        ['schema_version', 'empty'],
        ['article_id', 'empty'],
    ])('fails naming the %s when it is %s and writes no bundle', (field, state) => {
        const layout = makeLayout();
        const parsedPath = path.join(layout, 'corpus', 'P1', 'parse', 'parsed_paper.json');
        const parsed = JSON.parse(readFileSync(parsedPath, 'utf8'));
        if (state === 'missing') {
            delete parsed.header[field];
        } else {
            parsed.header[field] = '';
        }
        writeFileSync(parsedPath, JSON.stringify(parsed));
        const out = mkdtempSync(path.join(tmpdir(), 'review-fixtures-'));
        const run = () =>
            execFileSync('python3', ['-s', script, layout, out, 'P1'], {
                env: { ...process.env, PYTHONPATH: stubBackend() },
                stdio: 'pipe',
            });
        expect(run).toThrow(`P1: parsed_paper header has no ${field}`);
        expect(existsSync(path.join(out, 'P1.bundle.json'))).toBe(false);
    });
});
