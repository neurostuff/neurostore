// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import referenceManifest from '../../../backend/neurostore/review/schema/references.json';
import { sha256Of, stripDescriptions } from '../../scripts/sync-schemas.mjs';

const commitFile = path.join(__dirname, 'study-schema.commit');
const schemaFile = path.join(__dirname, 'extraction-record.schema.json');
const runtimeFile = path.join(__dirname, 'extraction-record.runtime.schema.json');
const digestFile = path.join(__dirname, 'study-schema.sha256');

describe('the extraction-record schema copy', () => {
    it('comes from the study_schema commit references.json is generated from', () => {
        const commit = existsSync(commitFile) ? readFileSync(commitFile, 'utf8').trim() : '';
        expect(commit).toBe(referenceManifest.study_schema_commit);
    });

    it('is the extraction record schema', () => {
        const schema = existsSync(schemaFile) ? JSON.parse(readFileSync(schemaFile, 'utf8')) : {};
        expect(schema.$id).toBe('https://neurostuff.org/schemas/neuroimaging-study-extraction');
    });

    it('has a runtime copy equal to the full copy without its descriptions', () => {
        const full = JSON.parse(readFileSync(schemaFile, 'utf8'));
        const runtime = JSON.parse(readFileSync(runtimeFile, 'utf8'));
        expect(runtime).toEqual(stripDescriptions(full));
    });

    it('records the sha256 of the full copy beside the commit, so an edited copy fails', () => {
        const recorded = existsSync(digestFile) ? readFileSync(digestFile, 'utf8').trim() : '';
        expect(recorded).toBe(sha256Of(readFileSync(schemaFile, 'utf8')));
    });
});
