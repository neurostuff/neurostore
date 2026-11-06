import { act } from '@testing-library/react';
import { acceptTarget } from '../inspector/actions';
import { analysisTarget } from '../model/targetKey';
import { createReviewStores } from '../store/reviewStores';
import { coordinateBundle, FACES, HOUSES, LOCALIZER, SCRAMBLED } from '../test/coordinates';
import { selectStepProgress } from './stepCount';

const setup = () => {
    const stores = createReviewStores(coordinateBundle());
    const progress = (step: Parameters<typeof selectStepProgress>[1]) =>
        selectStepProgress(stores.session.getState(), step);
    const judge = (key: string) => act(() => void acceptTarget(stores, analysisTarget(key)));
    return { stores, progress, judge };
};

describe('the progress of the coordinates step', () => {
    it('counts the analyses with points, and never one without, whether or not the view shows it', () => {
        const { stores, progress, judge } = setup();
        expect(progress('coordinates')).toMatchObject({ done: 0, total: 3, text: '0 of 3' });
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(progress('coordinates')).toMatchObject({ done: 0, total: 3, text: '0 of 3' });
        judge(SCRAMBLED.key);
        expect(progress('coordinates')).toMatchObject({ done: 0, total: 3 });
    });

    it('counts a judged analysis once it is judged', () => {
        const { progress, judge } = setup();
        judge(FACES.key);
        expect(progress('coordinates')).toMatchObject({ done: 1, total: 3, text: '1 of 3', complete: false });
    });

    it('is complete only when every one is judged', () => {
        const { progress, judge } = setup();
        judge(FACES.key);
        judge(HOUSES.key);
        expect(progress('coordinates').complete).toBe(false);
        judge(LOCALIZER.key);
        expect(progress('coordinates')).toMatchObject({ done: 3, total: 3, complete: true });
    });

    it('has no count and is never complete for the submit step', () => {
        const { progress } = setup();
        expect(progress('submit')).toEqual({ done: 0, total: 0, text: '', complete: false });
    });

    it('is the same object while nothing it reads has changed', () => {
        const { stores, progress } = setup();
        const before = progress('coordinates');
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(progress('coordinates')).toBe(before);
    });
});
