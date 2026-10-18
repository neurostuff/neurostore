import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import {
    coordinateResult,
    coordinateBundle,
    COORD_TEXT,
    FACES,
    HOUSES,
    key,
    LOCALIZER,
    SCRAMBLED,
} from '../test/coordinates';
import { newPointsGrid } from '../test/grid';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';
import { TextIndex } from '../text/TextIndex';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const session = () => view.stores.session.getState();
    const select = (phrase: string) =>
        act(() => {
            const start = COORD_TEXT.indexOf(phrase);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(TextIndex.build(view.textRoot()).toRange(start, start + phrase.length));
            document.dispatchEvent(new Event('selectionchange'));
        });
    return { ...view, session, pending: () => session().pending, select };
}

const SENTENCE = 'The precuneus peaked at x = 4, y = -60, z = 40 in the localizer.';

describe('a new coordinate analysis from a selection', () => {
    it('is offered by the selection bar in the coordinates step, with the selection’s x, y and z as its first point', async () => {
        const { select } = setup();
        select(SENTENCE);
        fireEvent.click(
            within(screen.getByRole('toolbar', { name: 'selection' })).getByRole('button', {
                name: 'New coordinate analysis from selection',
            })
        );
        const form = screen.getByRole('group', { name: 'new analysis from the selected text' });
        expect(within(form).getByRole('textbox', { name: 'name' })).toHaveFocus();
        expect((await newPointsGrid(form)).data).toEqual([expect.objectContaining({ x: 4, y: -60, z: 40 })]);
        expect(within(form).getByRole('combobox', { name: 'coordinate space' })).toHaveValue('MNI');
    });

    it('adds an analysis read from the text, the selection its span', () => {
        const { select, pending } = setup();
        select(SENTENCE);
        fireEvent.click(screen.getByRole('button', { name: 'New coordinate analysis from selection' }));
        const form = screen.getByRole('group', { name: 'new analysis from the selected text' });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Localizer peak' } });
        fireEvent.click(within(form).getByRole('button', { name: 'Add analysis' }));
        const start = COORD_TEXT.indexOf(SENTENCE);
        expect(pending()).toEqual([
            expect.objectContaining({
                type: 'coordinate',
                action: 'add',
                target: { kind: 'coordinate_parse' },
                payload: {
                    analysis: {
                        origin: 'text',
                        text_spans: [{ start_char: start, end_char: start + SENTENCE.length }],
                        name: 'Localizer peak',
                        role: 'result',
                        coordinate_space: 'MNI',
                        points: [{ coordinates: [4, -60, 40] }],
                    },
                },
            }),
        ]);
        expect(coordinateOpErrors(pending())).toEqual([]);
    });

    it('once added, the new card is focused and the text shows it', () => {
        const { select, pending, session, stores } = setup();
        select(SENTENCE);
        fireEvent.click(screen.getByRole('button', { name: 'New coordinate analysis from selection' }));
        const form = screen.getByRole('group', { name: 'new analysis from the selected text' });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Localizer peak' } });
        fireEvent.click(within(form).getByRole('button', { name: 'Add analysis' }));
        const start = COORD_TEXT.indexOf(SENTENCE);
        const added = {
            key: key(0x9a9),
            origin: 'text',
            text_spans: [{ start_char: start, end_char: start + SENTENCE.length }],
            name: 'Localizer peak',
            role: 'result',
            coordinate_space: 'MNI',
            points: [{ coordinates: [4, -60, 40] as [number, number, number] }],
        };
        const sent = pending();
        act(() => session().confirm(coordinateResult(sent, [FACES, HOUSES, LOCALIZER, SCRAMBLED, added]), sent));
        expect(screen.getByRole('article', { name: 'Localizer peak' })).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('region', { name: 'Localizer peak' })).toBeInTheDocument();
        expect(stores.view.getState().reveal?.span).toEqual([start, start + SENTENCE.length]);
    });
});
