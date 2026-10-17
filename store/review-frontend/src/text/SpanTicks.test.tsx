import { act, fireEvent, screen } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import type { Block } from '../model/layout';
import { TextIndex } from './TextIndex';
import { TextPane } from './TextPane';

const TEXT = '# A paper\n\nWe scanned twenty patients on a 3 T scanner.\n\nControls were matched for age.\n';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty'), at('A paper')]) },
        { local_id: 'grp_b', name: ev('Controls', [at('Controls')]), age: ev('matched', [at('age')]) },
    ],
};
const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));

/** Lays the text out one pixel per character times `scale`, in a scroller 1000 px high. */
function placeRects(root: () => HTMLElement, scroller: HTMLElement, scale: { by: number }) {
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 1000 });
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
        const [start] = TextIndex.build(root()).fromRange(this)!;
        return [new DOMRect(0, start * scale.by - scroller.scrollTop, 10, 10)] as unknown as DOMRectList;
    });
}

function setup(aside?: (props: { block: Block | null }) => null) {
    const view = renderWithStores(<TextPane aside={aside} />, makeBundle(record, TEXT, { entities }));
    const scroller = view.container.querySelector<HTMLElement>('[data-text-scroller]')!;
    const scale = { by: 10 };
    placeRects(view.textRoot, scroller, scale);
    return { ...view, scroller, scale };
}

const ticks = (name: string | RegExp) => screen.queryAllByRole('button', { name });
/** Each tick's top, in percent of the rail, to two places. */
const tops = (name: string | RegExp) => ticks(name).map((tick) => Math.round(parseFloat(tick.style.top) * 100) / 100);
const percent = (offset: number, by = 10) => (offset * by) / 10;

describe('scrollbar ticks', () => {
    it('puts a tick for each span of the focused item at the span’s height in the text', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(tops(/^evidence \d+$/)).toEqual([percent(at('A paper')[0]), percent(at('twenty')[0])]);
        expect(ticks('other evidence')).toEqual([]);
    });

    it('adds a faint tick for every other span while all evidence is shown', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        act(() => stores.view.getState().toggleAllEvidence(true));
        expect(tops('other evidence')).toEqual(
            [at('scanned'), at('patients'), at('Controls'), at('age')].map(([start]) => percent(start))
        );
        expect(ticks(/^evidence \d+$/)).toHaveLength(2);
    });

    it('reveals the span a tick stands for when it is clicked, as stepping to it does', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        fireEvent.click(screen.getByRole('button', { name: 'evidence 2' }));
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        expect(stores.view.getState().reveal?.span).toEqual(at('twenty'));
    });

    /** Stands in for ResizeObserver, keeping every observer made and the elements each observes. */
    function observeResizes() {
        const observers: { callback: () => void; elements: Element[] }[] = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                private readonly observer: (typeof observers)[number];
                constructor(callback: () => void) {
                    this.observer = { callback, elements: [] };
                    observers.push(this.observer);
                }
                observe(element: Element) {
                    this.observer.elements.push(element);
                }
                disconnect() {
                    this.observer.elements = [];
                }
            }
        );
        return (element: Element) =>
            act(() => observers.filter((o) => o.elements.includes(element)).forEach((o) => o.callback()));
    }

    it('measures the ticks again on a resize, not on a scroll', () => {
        const resize = observeResizes();
        const { stores, scroller, scale } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_b:age'));
        expect(tops('evidence 1')).toEqual([percent(at('age')[0])]);
        scale.by = 5;
        act(() => {
            scroller.scrollTop = 40;
            fireEvent.scroll(scroller);
        });
        expect(tops('evidence 1')).toEqual([percent(at('age')[0])]);
        resize(scroller);
        expect(tops('evidence 1')).toEqual([percent(at('age')[0], 5)]);
        vi.unstubAllGlobals();
    });

    it('measures the ticks again when the text reflows inside a scroller that keeps its size', () => {
        const resize = observeResizes();
        const { stores, textRoot, scale } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_b:age'));
        scale.by = 5;
        resize(textRoot());
        expect(tops('evidence 1')).toEqual([percent(at('age')[0], 5)]);
        vi.unstubAllGlobals();
    });

    it('does not render the text again when the focus or its ticks change', () => {
        const renders = vi.fn();
        const Counter = ({ block }: { block: Block | null }) => {
            if (block === null) renders();
            return null;
        };
        const { stores } = setup(Counter);
        expect(renders).toHaveBeenCalledTimes(1);
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        act(() => stores.view.getState().stepEvidence(1));
        act(() => stores.view.getState().focusEntity('grp_b'));
        expect(ticks(/^evidence \d+$/)).toHaveLength(2);
        expect(renders).toHaveBeenCalledTimes(1);
    });
});
