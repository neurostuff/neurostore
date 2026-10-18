import { act, fireEvent, screen, within } from '@testing-library/react';
import { coordinateBundle } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { keyLabel, SHORTCUTS, type Scope } from './shortcuts';
import { ReviewScreen } from './ReviewScreen';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

const setup = () => renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });

/** The hover text a control has: its own title (an icon's, its title element), or the one its tooltip puts on the span wrapping only it. */
const hintOf = (control: Element) => {
    const wrapper = control.parentElement;
    const wrapped = wrapper?.tagName === 'SPAN' && wrapper.children.length === 1;
    return (
        control.getAttribute('title') ??
        control.querySelector(':scope > title')?.textContent ??
        (wrapped ? wrapper.getAttribute('title') : null) ??
        ''
    );
};

const unhinted = () =>
    screen
        .getAllByRole('button')
        .filter((button) => !button.closest('[data-coordinate-table]') && hintOf(button) === '')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);

describe('help you can find', () => {
    it('has a Help button in the header that opens the shortcut sheet ? opens', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: 'Help' }));
        expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    });

    it('lists the keys of the divider between the text and the inspector in the shortcut sheet', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: 'Help' }));
        const rows = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).getAllByRole('row');
        const divider = rows.filter((row) => row.lastElementChild?.textContent === 'the pane divider');
        expect(divider.map((row) => row.firstElementChild?.textContent)).toEqual(['← →', 'Shift+← →', 'Home End']);
        expect(screen.getByRole('dialog')).toHaveTextContent('double-click it to go back to 60/40');
    });

    it('gives every control on the coordinates step a tooltip', () => {
        setup();
        expect(unhinted()).toEqual([]);
    });

    it('gives every control on a record step a tooltip, the focused field’s actions too', () => {
        const { stores } = setup();
        act(() => stores.view.getState().setStep('analyses'));
        const [first] = stores.session.getState().index.visible.filter((e) => e.entityClass === 'Analysis');
        act(() => stores.view.getState().focusSlot(first.slots[0].key));
        expect(unhinted()).toEqual([]);
    });

    it('names the key of an action in its tooltip', () => {
        const { stores } = setup();
        act(() => stores.view.getState().setStep('analyses'));
        expect(hintOf(screen.getByRole('button', { name: 'Help' }))).toBe('Keyboard shortcuts and help (?)');
    });

    describe('the action controls', () => {
        const buttonShortcuts = SHORTCUTS.filter((shortcut) => shortcut.button);
        const actionControls = () =>
            screen
                .getAllByRole('toolbar')
                .flatMap((toolbar) => within(toolbar).queryAllByRole('button'))
                .filter((control) => control.hasAttribute('aria-keyshortcuts'));

        const namesItsKey = (control: Element, scope: Scope) => {
            const label = control.textContent;
            const shortcut = buttonShortcuts.find((s) => s.scope === scope && s.button!.label === label)!;
            if (!control.matches(':disabled')) return hintOf(control).endsWith(`(${keyLabel(shortcut.keys[0])})`);
            return hintOf(control) !== '' && !hintOf(control).endsWith(')');
        };

        it('each name their key in their hint, or, when disabled, say why they do not apply, on the coordinates step', () => {
            setup();
            const controls = actionControls();
            expect(controls.length).toBeGreaterThan(0);
            expect(
                controls.filter((control) => !namesItsKey(control, 'coordinates')).map((c) => c.textContent)
            ).toEqual([]);
        });

        it('each name their key in their hint, beside the field and in the toolbar, on a record step', () => {
            const { stores } = setup();
            act(() => stores.view.getState().setStep('analyses'));
            const [first] = stores.session.getState().index.visible.filter((e) => e.entityClass === 'Analysis');
            act(() => stores.view.getState().focusSlot(first.slots[0].key));
            const controls = actionControls();
            expect(screen.getAllByRole('toolbar', { name: /^actions on / })).toHaveLength(1);
            expect(controls.length).toBeGreaterThan(10);
            expect(controls.filter((control) => !namesItsKey(control, 'record')).map((c) => c.textContent)).toEqual([]);
        });
    });
});
