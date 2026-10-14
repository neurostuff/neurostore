import { act, screen } from '@testing-library/react';
import { registeredSpans } from '../test/highlights';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { TextIndex } from './TextIndex';
import { TextPane } from './TextPane';

const TEXT = '# A paper\n\nWe scanned twenty patients on a 3 T scanner.\n\nControls were matched for age.\n';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty'), at('A paper')]) },
        {
            local_id: 'grp_b',
            name: ev('Controls', [at('Controls')]),
            species: notReported(),
            sex: ev('mixed'),
            age: ev('matched', [at('Controls'), at('age')]),
        },
    ],
};

const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));
const setup = () => renderWithStore(<TextPane />, makeBundle(record, TEXT, { entities }));
const styleText = () => [...document.querySelectorAll('style')].map((style) => style.textContent).join('');

describe('TextPane highlights', () => {
    it('registers the focused item’s spans as the focus highlight and all other evidence as underlines', () => {
        const { textRoot } = setup();
        expect(textRoot().textContent).toBe(TEXT);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('scanned')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('A paper'),
            at('twenty'),
            at('patients'),
            at('Controls'),
            at('age'),
        ]);
    });

    it('changes only the registered ranges when focus changes, never the text DOM', () => {
        const { store, textRoot } = setup();
        const before = TextIndex.build(textRoot()).textNodes();
        act(() => store.getState().focusSlot('slot:grp_a:n'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('scanned'),
            at('patients'),
            at('Controls'),
            at('age'),
        ]);
        const after = TextIndex.build(textRoot()).textNodes();
        expect(after).toHaveLength(before.length);
        after.forEach((node, i) => expect(node).toBe(before[i]));
    });

    it('keeps the underlines right after evidence is added and focus moves on', () => {
        const { store, textRoot } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:name'));
        act(() => void store.getState().addEvidence(at('matched'), 'first'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('patients'), at('matched')]);
        expect(registeredSpans('rv-evidence', textRoot())).not.toContainEqual(at('matched'));
        act(() => store.getState().focusSlot('slot:grp_b:name'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('Controls')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('A paper'),
            at('scanned'),
            at('twenty'),
            at('patients'),
            at('matched'),
            at('age'),
        ]);
    });

    it('fills the focused spans and underlines the rest with a dotted line', () => {
        setup();
        expect(styleText()).toContain('::highlight(rv-focus){background-color:rgba(0, 119, 182, 0.3);}');
        expect(styleText()).toContain(
            '::highlight(rv-evidence){text-decoration-line:underline;text-decoration-style:dotted;text-decoration-color:rgba(0, 119, 182, 0.45);}'
        );
    });
});

describe('TextPane evidence navigation', () => {
    const placeRangesByOffset = (root: HTMLElement, scroller: HTMLElement) =>
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
            return { top: TextIndex.build(root).fromRange(this)![0] - scroller.scrollTop } as DOMRect;
        });

    it('counts the focused item’s evidence and steps through it with wrapping', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:n'));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        act(() => store.getState().stepEvidence(1));
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        act(() => store.getState().stepEvidence(1));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        act(() => store.getState().focusEntity('grp_a'));
        expect(screen.getByText('evidence 1 of 3')).toBeInTheDocument();
    });

    it('says when a slot has no evidence or was not reported', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_b:sex'));
        expect(screen.getByText('no evidence')).toBeInTheDocument();
        act(() => store.getState().focusSlot('slot:grp_b:species'));
        expect(screen.getByText('not reported')).toBeInTheDocument();
    });

    it('scrolls the text to the focused slot’s first evidence span, then to the span stepped to', () => {
        const { store, textRoot, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        placeRangesByOffset(textRoot(), scroller);
        act(() => store.getState().focusSlot('slot:grp_a:n'));
        expect(scroller.scrollTop).toBe(at('A paper')[0]);
        act(() => store.getState().stepEvidence(1));
        expect(scroller.scrollTop).toBe(at('twenty')[0]);
    });

    it('starts again at the first span, and scrolls to it, when another slot is focused after stepping', () => {
        const { store, textRoot, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        placeRangesByOffset(textRoot(), scroller);
        act(() => store.getState().focusSlot('slot:grp_a:n'));
        act(() => store.getState().stepEvidence(1));
        act(() => store.getState().focusSlot('slot:grp_b:age'));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        expect(scroller.scrollTop).toBe(at('Controls')[0]);
    });
});
