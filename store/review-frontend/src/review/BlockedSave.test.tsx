import { ThemeProvider } from '@mui/material';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReviewApi } from '../api/reviewApi';
import { createReviewStores, OpClientProvider, type ReviewStores, ReviewStoresProvider } from '../store/context';
import { createOpClient } from '../store/opClient';
import { slotKey } from '../model/targetKey';
import { ev, makeBundle } from '../test/bundles';
import { theme } from '../theme';
import { BlockedSave } from './BlockedSave';
import type { SpanPair } from '../model/record';
import type { EvidenceMode } from '../store/sessionStore';

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const bundle = makeBundle({ description: ev('A study'), design: { description: ev('fMRI') } }, TEXT);

function setup() {
    const store: ReviewStores = createReviewStores(bundle);
    const api = { postOps: () => new Promise<never>(() => {}) } as unknown as ReviewApi;
    const client = createOpClient(store.session, api);
    const { focusSlot } = store.view.getState();
    const addEvidence = (span: SpanPair, mode: EvidenceMode) =>
        store.session.getState().addEvidence(store.view.getState().focus.key, span, mode);
    focusSlot(slotKey('study', 'description'));
    addEvidence([TEXT.indexOf('Twenty'), TEXT.indexOf('Twenty') + 'Twenty'.length], 'new');
    focusSlot(slotKey('study', 'design.description'));
    addEvidence([TEXT.indexOf('fMRI'), TEXT.indexOf('fMRI') + 'fMRI'.length], 'new');
    const pending = store.session.getState().pending;
    store.session
        .getState()
        .block(pending, 'the batch leaves an invalid document', ['extraction-record /description: too long']);
    render(
        <ThemeProvider theme={theme}>
            <MemoryRouter>
                <ReviewStoresProvider stores={store}>
                    <OpClientProvider client={client}>
                        <BlockedSave />
                    </OpClientProvider>
                </ReviewStoresProvider>
            </MemoryRouter>
        </ThemeProvider>
    );
    return { store, pending };
}

afterEach(() => vi.restoreAllMocks());

describe('a refused save that names no op', () => {
    it('explains the refusal in the reviewer’s terms, with a link that focuses the slot', () => {
        const { store } = setup();
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('too long');
        expect(alert).not.toHaveTextContent('/description');
        act(() => fireEvent.click(within(alert).getByRole('button', { name: /description/ })));
        expect(store.view.getState().focus.key).toBe(slotKey('study', 'description'));
    });

    it('lists the pending edits, each by its op and slot', () => {
        const { pending } = setup();
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(`Pending edits (${pending.length})`);
        expect(alert).toHaveTextContent('set_evidence: Study · description');
        expect(alert).toHaveTextContent('set_evidence: Study · design.description');
    });

    it('discards every pending edit and resumes saving', () => {
        const { store } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().save).toBe('idle');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('downloads the pending ops as a JSON file', async () => {
        const { store } = setup();
        const blobs: Blob[] = [];
        URL.createObjectURL = vi.fn((blob: Blob) => (blobs.push(blob), 'blob:pending'));
        URL.revokeObjectURL = vi.fn();
        const downloads: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });
        fireEvent.click(screen.getByRole('button', { name: 'Download' }));
        expect(downloads).toEqual(['pending-edits.json']);
        const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(blobs[0]);
        });
        expect(JSON.parse(text)).toEqual(store.session.getState().pending);
    });

    it('keeps an edit made after the refusal when it undoes the refused ones', () => {
        const { store } = setup();
        const { focusSlot } = store.view.getState();
        const addEvidence = (span: SpanPair, mode: EvidenceMode) =>
            store.session.getState().addEvidence(store.view.getState().focus.key, span, mode);
        focusSlot(slotKey('study', 'description'));
        addEvidence([TEXT.indexOf('Stroop'), TEXT.indexOf('Stroop') + 'Stroop'.length], 'new');
        const [later] = store.session.getState().pending.slice(-1);
        fireEvent.click(screen.getByRole('button', { name: 'Undo the edits that caused it' }));
        expect(store.session.getState().pending).toEqual([later]);
    });

    it('undoes the edits that caused the refusal, and leaves the save blocked no longer', () => {
        const { store } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Undo the edits that caused it' }));
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().blocked).toBeNull();
        expect(store.session.getState().save).toBe('idle');
    });
});
