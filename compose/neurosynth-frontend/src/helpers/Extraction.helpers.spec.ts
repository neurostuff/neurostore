import { describe, expect, it } from 'vitest';
import { mapStubsToStudysetPayload } from './Extraction.helpers';
import { BaseStudyReturn, StudyReturn } from 'neurostore-typescript-sdk';

const makeBaseStudy = (id: string, versionIds: string[]): BaseStudyReturn => ({
    id,
    versions: versionIds.map<StudyReturn>((vid, idx) => ({
        id: vid,
        updated_at: idx.toString(), // for sorting fallback
    })),
});

describe('mapStubsToStudysetPayload', () => {
    it('zips stubs to base studies by index and carries stub UUIDs', () => {
        const stubs = [{ id: 'stub-1' }, { id: 'stub-2' }];
        const baseStudies: Array<BaseStudyReturn> = [
            makeBaseStudy('bs1', ['v1a']),
            makeBaseStudy('bs2', ['v2a']),
        ];

        const payload = mapStubsToStudysetPayload(stubs, baseStudies);
        expect(payload).toEqual([
            { id: 'v1a', curation_stub_uuid: 'stub-1' },
            { id: 'v2a', curation_stub_uuid: 'stub-2' },
        ]);
    });

    it('prefers an existing study ID when present', () => {
        const stubs = [{ id: 'stub-1' }];
        const existing = new Set<string>(['existing-id']);
        const baseStudies: Array<BaseStudyReturn> = [
            makeBaseStudy('bs1', ['existing-id', 'new-id']),
        ];

        const payload = mapStubsToStudysetPayload(stubs, baseStudies, existing);
        expect(payload[0]).toEqual({ id: 'existing-id', curation_stub_uuid: 'stub-1' });
    });

    it('prefers the study mapped to the stub when provided', () => {
        const stubs = [{ id: 'stub-1' }];
        const baseStudies: Array<BaseStudyReturn> = [makeBaseStudy('bs1', ['old-id', 'new-id'])];
        const stubMap = new Map<string, string>([['stub-1', 'new-id']]);

        const payload = mapStubsToStudysetPayload(stubs, baseStudies, undefined, stubMap);
        expect(payload[0]).toEqual({ id: 'new-id', curation_stub_uuid: 'stub-1' });
    });

    it('returns the locked existing mapping even if ingest lacks that version', () => {
        const stubs = [{ id: 'stub-1' }];
        // ingest returned only a different version
        const baseStudies: Array<BaseStudyReturn> = [makeBaseStudy('bs1', ['different-id'])];
        const lockedMap = new Map<string, string>([['stub-1', 'existing-id']]);

        const payload = mapStubsToStudysetPayload(
            stubs,
            baseStudies,
            undefined,
            undefined,
            lockedMap
        );
        expect(payload[0]).toEqual({ id: 'existing-id', curation_stub_uuid: 'stub-1' });
    });
});
