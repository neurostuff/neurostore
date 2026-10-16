import { act, fireEvent, screen } from '@testing-library/react';
import type { ReviewApi } from '../api/reviewApi';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { createOpClient } from '../store/opClient';
import { theme } from '../theme';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { ReviewAppBar } from './ReviewAppBar';
import { SaveNotices } from './SaveNotices';

const bundle = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.');
const op = { client_op_id: 'op-00000001' } as Op;

describe('the save indicator', () => {
    it('says saved, N unsaved, saving or offline', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        const indicator = () => screen.getByLabelText(/^save state/);
        expect(indicator()).toHaveTextContent('saved');
        act(() => stores.session.setState({ pending: [op, op] }));
        expect(indicator()).toHaveTextContent('2 unsaved');
        act(() => stores.session.setState({ save: 'saving' }));
        expect(indicator()).toHaveTextContent('saving');
        act(() => stores.session.setState({ save: 'offline' }));
        expect(indicator()).toHaveTextContent('offline');
    });
});

describe('a refused save', () => {
    it('shows the error in red', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        act(() =>
            stores.session.setState({
                blocked: { clientOpIds: [], problems: ['the batch leaves an invalid document'] },
                saveMessage: 'the batch leaves an invalid document',
            })
        );
        const indicator = screen.getByLabelText(/^save state/);
        expect(indicator).toHaveTextContent('the batch leaves an invalid document');
        expect(indicator).toHaveStyle({ color: theme.palette.error.main });
    });
});

describe('a save that needs a sign-in', () => {
    it('shows the sign-in prompt for the code Auth0 reports', async () => {
        const signedOut = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
            review: { id: 'R1', state: 'in_progress', last_seq: 0 } as unknown as ReviewBundle['review'],
        });
        const { stores } = renderWithStores(<ReviewAppBar />, signedOut);
        const api = {
            postOps: async () => {
                throw Object.assign(new Error('Login required'), { error: 'login_required' });
            },
        } as unknown as ReviewApi;
        const client = createOpClient(stores.session, api);
        act(() => stores.session.setState({ pending: [op] }));
        await act(() => client.flush());
        expect(screen.getByLabelText(/^save state/)).toHaveTextContent('sign in to save');
        client.stop();
    });
});

describe('save notices', () => {
    it('name each dropped op’s slot without blocking, until dismissed', () => {
        const { stores } = renderWithStores(<SaveNotices />, bundle);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        act(() =>
            stores.session.setState({
                notices: [
                    { kind: 'conflict', slot: 'study description', message: 'set a value first' },
                    { kind: 'refused', slot: 'grp_a age_mean', message: 'op 1: too long' },
                ],
            })
        );
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('study description');
        expect(banner).toHaveTextContent('changed elsewhere');
        expect(banner).toHaveTextContent('grp_a age_mean');
        expect(banner).toHaveTextContent('op 1: too long');
        fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(stores.session.getState().notices).toEqual([]);
    });
});

describe('non-coordinate analyses', () => {
    const withAnalysis = makeBundle(
        { description: ev('A study', [[0, 4]]), analyses: [{ local_id: 'a_hidden', name: ev('Hidden') }] },
        'Text of the paper.',
        {
            entities: entityRows(row('a_hidden', 'Analysis', 'analyses')),
            hidden: { analyses: ['a_hidden'], entities: [] },
        }
    );

    it('has a toggle that shows and hides them, as Shift+H does', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, withAnalysis);
        const toggle = screen.getByRole('button', { name: 'non-coordinate analyses' });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(toggle);
        expect(stores.view.getState().showNonCoordinate).toBe(true);
        expect(screen.getByRole('button', { name: 'non-coordinate analyses' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('counts reviewed coordinate items apart from the non-coordinate analyses, whether or not they are shown', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, withAnalysis);
        const progress = () => screen.getByText(/reviewed, plus/);
        const coordinateSlots = stores.session.getState().index.visible.flatMap((e) => e.slots);
        const total = coordinateSlots.length;
        expect(progress()).toHaveTextContent(`0 of ${total} reviewed, plus 1 non-coordinate analysis`);
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(progress()).toHaveTextContent(`0 of ${total} reviewed, plus 1 non-coordinate analysis`);
        const reviewed = coordinateSlots[0].key;
        act(() =>
            stores.session.setState({ provenance: { [reviewed]: { state: 'verified', user_id: 'u1', at: '' } } })
        );
        expect(progress()).toHaveTextContent(`1 of ${total} reviewed, plus 1 non-coordinate analysis`);
    });
});

describe('the reviewers who have edited the paper', () => {
    it('lists each reviewer with ops, their op count and last edit, and the exact time on hover', () => {
        const lastEdit = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const edited = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
            reviewers: [
                { user_id: 'ana', name: 'Ana', state: 'in_progress', op_count: 3, last_edit_at: lastEdit },
                { user_id: 'ben', name: 'Ben', state: 'in_progress', op_count: 0, last_edit_at: null },
            ],
        });
        renderWithStores(<ReviewAppBar />, edited);
        const line = screen.getByText('Ana: last edit 2 h ago, 3 ops');
        expect(line).toHaveAttribute('title', new Date(lastEdit).toLocaleString());
        expect(screen.queryByText(/^Ben:/)).not.toBeInTheDocument();
    });
});
