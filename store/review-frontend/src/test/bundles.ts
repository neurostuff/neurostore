import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../contract/generated/review-bundle';

type Json = Record<string, unknown>;
type EntityRow = ReviewBundle['entities'][number];

export const STUDY_ROW: EntityRow = {
    local_id: 'study',
    entity_class: 'Study',
    schema_class: 'Study',
    parent: null,
    list_path: null,
};

export const row = (
    local_id: string,
    entity_class: string,
    list_path: string,
    { parent = 'study', schema_class = entity_class }: { parent?: string; schema_class?: string } = {}
): EntityRow => ({ local_id, entity_class, schema_class, parent, list_path });

export const entityRows = (...rows: EntityRow[]) => [STUDY_ROW, ...rows];

export const ev = (value: unknown, spans: [number, number][] = [], source: 'reported' | 'generated' = 'reported') => ({
    extraction_status: 'extracted',
    value,
    value_source: source,
    evidence: spans.length
        ? { status: 'present', sets: [{ spans: spans.map(([start_char, end_char]) => ({ start_char, end_char })) }] }
        : { status: 'not_found' },
});

export const notReported = (reason = 'ambiguous') => ({
    extraction_status: 'not_reported',
    unreported_reason: reason,
    evidence: { status: 'not_applicable' },
});

export function makeBundle(record: Json, text: string, overrides: Partial<ReviewBundle> = {}): ReviewBundle {
    return {
        source: {
            id: 'P1',
            base_study_id: 'P1',
            label: 'A paper',
            origin: 'upload',
            text_sha256: '0'.repeat(64),
            schema_versions: { paper_parse: '0.6.0', extraction: 'test' },
        },
        text,
        parsed_paper: { bibliography: { title: 'A paper' } },
        coordinate_parse: { analyses: [] },
        record: { local_id: 'P1', ...record },
        coordinate_revision: null,
        review: null,
        ops: [],
        entities: [STUDY_ROW],
        hidden: { analyses: [], entities: [] },
        reviewers: [],
        ...overrides,
    };
}

const fixturesDir = path.resolve(__dirname, '../../fixtures');

export function fixturePath(id: string) {
    return path.join(fixturesDir, `${id}.bundle.json`);
}

export function hasFixture(id: string) {
    return existsSync(fixturePath(id));
}

export function loadFixture(id: string): ReviewBundle {
    return JSON.parse(readFileSync(fixturePath(id), 'utf8'));
}
