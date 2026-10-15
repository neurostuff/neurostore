import { act, fireEvent, screen } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ev, makeBundle } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { ReviewAppBar } from './ReviewAppBar';
import { SaveNotices } from './SaveNotices';

const bundle = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.');
const op = { client_op_id: 'op-00000001' } as Op;

describe('the save indicator', () => {
    it('says saved, N unsaved, saving or offline', () => {
        const { store } = renderWithStore(<ReviewAppBar />, bundle);
        const indicator = () => screen.getByLabelText(/^save state/);
        expect(indicator()).toHaveTextContent('saved');
        act(() => store.setState({ pending: [op, op] }));
        expect(indicator()).toHaveTextContent('2 unsaved');
        act(() => store.setState({ save: 'saving' }));
        expect(indicator()).toHaveTextContent('saving');
        act(() => store.setState({ save: 'offline' }));
        expect(indicator()).toHaveTextContent('offline');
    });
});

describe('save notices', () => {
    it('name each dropped op’s slot without blocking, until dismissed', () => {
        const { store } = renderWithStore(<SaveNotices />, bundle);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        act(() =>
            store.setState({
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
        expect(store.getState().notices).toEqual([]);
    });
});
