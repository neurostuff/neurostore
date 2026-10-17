import { act, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { savePoints } from './actions';
import { coordinateBundle, coordinateResult, CUNEUS, FACES, HOUSES, LOCALIZER, SCRAMBLED } from '../test/coordinates';
import { renderWithStores } from '../test/render';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

const setup = () => renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });

describe('what an analysis card shows first', () => {
    it('its space, where it is read from and its points, before any internals', () => {
        setup();
        expect(
            within(screen.getByRole('article', { name: FACES.name })).getByText('MNI · from Table 1 · 2 points')
        ).toBeInTheDocument();
        expect(
            within(screen.getByRole('article', { name: LOCALIZER.name })).getByText(
                'MNI · from the text (Results) · 1 point'
            )
        ).toBeInTheDocument();
    });

    it('right under the name, the key and the origin nowhere in the card’s text', () => {
        setup();
        const card = screen.getByRole('article', { name: FACES.name });
        const [head, next] = [...card.children];
        expect(head).toContainElement(within(card).getByRole('button', { name: `rename ${FACES.name}` }));
        expect(next).toBe(within(card).getByText('MNI · from Table 1 · 2 points'));
        expect(card.textContent).not.toContain(FACES.key);
        expect(card.textContent).not.toMatch(/origin|table_id/);
    });

    it('follows a result that changes an analysis where it stands', () => {
        const { stores } = setup();
        const points = [...FACES.points!, CUNEUS];
        act(() => void savePoints(stores, FACES.key, points));
        const sent = stores.session.getState().pending;
        act(() =>
            stores.session
                .getState()
                .confirm(coordinateResult(sent, [{ ...FACES, points }, HOUSES, LOCALIZER, SCRAMBLED]), sent)
        );
        expect(
            within(screen.getByRole('article', { name: FACES.name })).getByText('MNI · from Table 1 · 3 points')
        ).toBeInTheDocument();
    });

    it('in the inspector too, with the key only as the name’s tooltip', () => {
        setup();
        const inspector = screen.getByRole('region', { name: FACES.name });
        expect(within(inspector).getByText(/^MNI · from Table 1 · 2 points/)).toBeInTheDocument();
        expect(within(inspector).queryByText(FACES.key)).not.toBeInTheDocument();
        expect(within(inspector).getByRole('button', { name: `rename ${FACES.name}` })).toHaveAttribute(
            'title',
            FACES.key
        );
    });

    it('drops the reviewer chip when the status already names the reviewer', () => {
        const { stores } = setup();
        act(() =>
            stores.session.setState({
                provenance: { [`coordinate_analysis:${FACES.key}`]: { state: 'verified', user_id: 'u1', at: 'then' } },
            })
        );
        const card = screen.getByRole('article', { name: FACES.name });
        expect(within(card).getByText('verified by u1')).toBeInTheDocument();
        expect(within(card).queryByText('reviewer')).not.toBeInTheDocument();
    });
});
