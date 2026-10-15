import { act, fireEvent, screen } from '@testing-library/react';
import { makeBundle } from '../test/bundles';
import { renderWithStore } from '../test/render';
import type { OpClient } from '../store/opClient';
import { OpClientProvider } from '../store/context';
import { SubmitStep } from './SubmitStep';

const review = { id: 'r1', user_id: 'me', state: 'in_progress' as const, last_seq: 0, provenance: {}, annotations: {} };
const edit = {
    client_op_id: 'op-1',
    type: 'set_evidence' as const,
    target: { kind: 'slot' as const, entity: 'study', path: 'description' },
    evidence: { status: 'not_found' as const },
};

describe('the submit step', () => {
    it('is disabled while anything is unsaved, and enabled once everything is saved', () => {
        const client = { changeState: vi.fn(async () => {}) } as unknown as OpClient;
        const { store } = renderWithStore(
            <OpClientProvider client={client}>
                <SubmitStep />
            </OpClientProvider>,
            makeBundle({}, 'text', { review })
        );
        const submit = screen.getByRole('button', { name: 'Submit review' });
        expect(submit).toBeEnabled();
        act(() => store.setState({ pending: [edit] }));
        expect(submit).toBeDisabled();
        act(() => store.setState({ pending: [] }));
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        expect(client.changeState).toHaveBeenCalledWith('submitted');
    });
});
