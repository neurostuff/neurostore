import { describe, expect, it } from 'vitest';
import { mapStubsToStudysetPayload, selectBestBaseStudyVersion } from './Extraction.helpers';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { BaseStudyReturnInfo } from 'hooks/studies/studyQueries.types';
import { SearchDataType } from 'pages/Study/Study.types';

const makeVersion = (overrides: StudyReturn): StudyReturn => ({
    ...overrides,
});

const makeBaseStudy = (id: string, versions: StudyReturn[]): BaseStudyReturnInfo => ({
    id,
    versions,
});

describe('selectBestBaseStudyVersion', () => {
    const olderCoordinate = makeVersion({
        id: 'coord-old',
        has_coordinates: true,
        has_images: false,
        updated_at: '2024-01-01T00:00:00.000Z',
    });
    const newerCoordinate = makeVersion({
        id: 'coord-new',
        has_coordinates: true,
        has_images: false,
        updated_at: '2024-06-01T00:00:00.000Z',
    });
    const olderImage = makeVersion({
        id: 'image-old',
        has_coordinates: false,
        has_images: true,
        updated_at: '2024-02-01T00:00:00.000Z',
    });
    const newerImage = makeVersion({
        id: 'image-new',
        has_coordinates: false,
        has_images: true,
        updated_at: '2024-07-01T00:00:00.000Z',
    });

    it('picks the latest version when no preferred type is given', () => {
        const best = selectBestBaseStudyVersion([olderCoordinate, newerImage, newerCoordinate]);
        expect(best.id).toBe('image-new');
    });

    it('picks the latest matching preferred type', () => {
        expect(
            selectBestBaseStudyVersion([olderCoordinate, newerImage, newerCoordinate], SearchDataType.COORDINATE).id
        ).toBe('coord-new');
        expect(selectBestBaseStudyVersion([olderCoordinate, newerImage, olderImage], SearchDataType.IMAGE).id).toBe(
            'image-new'
        );
    });

    it('falls back to latest of any type when no version matches preferred type', () => {
        const best = selectBestBaseStudyVersion([olderCoordinate, newerCoordinate], SearchDataType.IMAGE);
        expect(best.id).toBe('coord-new');
    });
});

describe('mapStubsToStudysetPayload', () => {
    it('zips stubs to base studies by index and carries stub UUIDs', () => {
        const stubs = [{ id: 'stub-1' }, { id: 'stub-2' }];
        const baseStudies: Array<BaseStudyReturnInfo> = [
            makeBaseStudy('bs1', [makeVersion({ id: 'v1a', updated_at: '2024-01-01T00:00:00.000Z' })]),
            makeBaseStudy('bs2', [makeVersion({ id: 'v2a', updated_at: '2024-01-01T00:00:00.000Z' })]),
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
        const baseStudies: Array<BaseStudyReturnInfo> = [
            makeBaseStudy('bs1', [
                makeVersion({
                    id: 'existing-id',
                    has_images: true,
                    updated_at: '2024-01-01T00:00:00.000Z',
                }),
                makeVersion({
                    id: 'new-id',
                    has_coordinates: true,
                    updated_at: '2024-08-01T00:00:00.000Z',
                }),
            ]),
        ];

        const payload = mapStubsToStudysetPayload(stubs, baseStudies, existing, SearchDataType.COORDINATE);
        expect(payload[0]).toEqual({ id: 'existing-id', curation_stub_uuid: 'stub-1' });
    });

    it('selects the latest version of the preferred type when no existing id matches', () => {
        const stubs = [{ id: 'stub-1' }];
        const baseStudies: Array<BaseStudyReturnInfo> = [
            makeBaseStudy('bs1', [
                makeVersion({
                    id: 'coord-old',
                    has_coordinates: true,
                    updated_at: '2024-01-01T00:00:00.000Z',
                }),
                makeVersion({
                    id: 'image-new',
                    has_images: true,
                    updated_at: '2024-08-01T00:00:00.000Z',
                }),
                makeVersion({
                    id: 'coord-new',
                    has_coordinates: true,
                    updated_at: '2024-06-01T00:00:00.000Z',
                }),
            ]),
        ];

        const payload = mapStubsToStudysetPayload(stubs, baseStudies, undefined, SearchDataType.COORDINATE);
        expect(payload[0]).toEqual({ id: 'coord-new', curation_stub_uuid: 'stub-1' });
    });
});
