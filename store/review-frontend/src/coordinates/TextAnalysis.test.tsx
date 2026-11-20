import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { PROSE, PROSE_SENTENCE, PROSE_TEXT, proseBundle } from '../test/coordinates';
import { registeredSpans } from '../test/highlights';
import { renderWithStores } from '../test/render';
import { selectText } from '../test/selection';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup(bundle = proseBundle()) {
    const view = renderWithStores(<ReviewScreen />, bundle, { now: () => 'now' });
    return { ...view, session: () => view.stores.session.getState() };
}

const card = () => screen.getByRole('article', { name: PROSE.name });
const paragraphOf = (container: HTMLElement, phrase: string) =>
    [...container.querySelectorAll('.rv-paragraph')].find((p) => p.textContent?.includes(phrase))!;

describe('a text analysis with no spans of its own', () => {
    it('highlights the sentence its record entry gives, and sits beside that paragraph', () => {
        const { container, textRoot } = setup();
        expect(registeredSpans('rv-focus', textRoot())).toEqual([PROSE_SENTENCE]);
        const beside = paragraphOf(container, 'There was an effect').nextElementSibling as HTMLElement;
        expect(within(beside).getByRole('article')).toHaveAccessibleName(PROSE.name);
        expect(screen.getByText('evidence 1 of 1')).toBeInTheDocument();
    });

    it('says the source sentence is unknown, and how to add it, when nothing gives one', () => {
        setup(proseBundle({ sets: false, nameSpans: false, coordinates: [1, 2, 3] }));
        act(() => void 0);
        expect(within(card()).getByText(/source sentence unknown/)).toHaveTextContent(
            'source sentence unknown: select it in the paper, then press E'
        );
        expect(screen.getByText('source sentence unknown')).toHaveAttribute('data-evidence-counter');
    });

    it('E adds the selected sentence to the evidence of the record Analysis naming it, which then finds it', () => {
        const view = setup(proseBundle({ sets: false, nameSpans: false, coordinates: [1, 2, 3] }));
        const [start, end] = PROSE_SENTENCE;
        selectText(view.textRoot(), [start, end]);
        act(() => void fireEvent.keyDown(document.body, { key: 'e' }));
        expect(view.session().pending).toEqual([
            expect.objectContaining({
                type: 'set_evidence',
                target: { kind: 'slot', entity: 'a_prose', path: 'name' },
            }),
        ]);
        expect(registeredSpans('rv-focus', view.textRoot())).toContainEqual([start, end]);
        expect(PROSE_TEXT.slice(start, end)).toContain('X = 26');
    });
});
