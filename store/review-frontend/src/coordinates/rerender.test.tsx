import { act } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ReviewScreen } from '../review/ReviewScreen';
import {
    CUNEUS,
    coordinateBundle,
    coordinateResult,
    FACES,
    HOUSES,
    key,
    LOCALIZER,
    SCRAMBLED,
} from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { PointGrid } from './PointGrid';

vi.mock('./PointGrid', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./PointGrid')>();
    return { PointGrid: vi.fn(actual.PointGrid) };
});

const rendersOf = (analysisKey: string) =>
    vi.mocked(PointGrid).mock.calls.filter(([props]) => props.analysis.key === analysisKey).length;

beforeEach(() => {
    vi.mocked(PointGrid).mockClear();
});

describe('a coordinate result', () => {
    it('re-renders only the analyses it changes', () => {
        const { stores } = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
        const edit: Op = {
            client_op_id: 'c-render',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: HOUSES.key },
            action: 'edit_points',
            payload: { points: [CUNEUS] },
        };
        act(() => void stores.session.getState().emit(edit));
        const faces = rendersOf(FACES.key);
        const scrambled = rendersOf(SCRAMBLED.key);
        const edited = { ...HOUSES, key: key(0x2b2), derived_from: [HOUSES.key], points: [CUNEUS] };
        act(() =>
            stores.session.getState().confirm(coordinateResult([edit], [FACES, edited, LOCALIZER, SCRAMBLED]), [edit])
        );
        expect(rendersOf(FACES.key)).toBe(faces);
        expect(rendersOf(SCRAMBLED.key)).toBe(scrambled);
        expect(rendersOf(edited.key)).toBeGreaterThan(0);
    });
});
