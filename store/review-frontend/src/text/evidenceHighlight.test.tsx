import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import type { OpClient } from '../store/opClient';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { registeredSpans } from '../test/highlights';
import { renderThroughServer } from '../test/render';
import { selectText } from '../test/selection';

const SENTENCE = 'SAD-patients had larger GM volume in the right putamen.';
const TEXT = `# Results\n\nWithin these ROIs, we examined GM volume.\n\n${SENTENCE}\n`;
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const whole = at(SENTENCE);
const ids = Array.from({ length: 10 }, (_, i) => `grp_${i + 1}`);

const record = {
    groups: ids.map((local_id, i) => ({ local_id, name: ev(`Group ${i + 1}`, [whole]), n: ev(i, [whole]) })),
    analyses: [
        { local_id: 'ana_1', name: ev('SAD > HC', [whole]), spatial_scope: ev('roi', [at('Within these ROIs')]) },
    ],
};

const SCOPE = 'slot:ana_1:spatial_scope';

let server: FakeServer;
let client: OpClient;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
    client.stop();
    vi.useRealTimers();
    expect(server.invalid()).toEqual([]);
});

async function open() {
    const entities = entityRows(...ids.map((id) => row(id, 'Group', 'groups')), row('ana_1', 'Analysis', 'analyses'));
    server = fakeServer([
        makeBundle(record, TEXT, { entities, source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' } }),
    ]);
    const view = await renderThroughServer(<ReviewScreen />, server, 'S1');
    client = view.client;
    const { stores, textRoot } = view;
    act(() => stores.view.getState().focusSlot(SCOPE));
    const focused = () => registeredSpans('rv-focus', textRoot());
    const select = ([start, end]: [number, number]) => selectText(textRoot(), [start, end]);
    return { stores, focused, select };
}

const saved = async () => {
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => client.settled());
};
const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));
const posts = () => server.requests.filter((r) => r.method === 'POST');

describe('the focus highlight after an evidence edit', () => {
    it('includes a span added with E from a sentence many fields use, at once and once the server confirms', async () => {
        const { focused, select } = await open();
        const added = at('SAD-patients had larger GM volume');
        select(added);
        press('e');
        expect(focused()).toEqual([at('Within these ROIs'), added]);
        await saved();
        expect(posts()).toHaveLength(1);
        expect(focused()).toEqual([at('Within these ROIs'), added]);
    });

    it('drops a span removed with Backspace, at once and once the server confirms', async () => {
        const { stores, focused } = await open();
        act(() => stores.view.getState().focusSlot('slot:grp_3:n'));
        expect(focused()).toEqual([whole]);
        press('Backspace');
        expect(focused()).toEqual([]);
        await saved();
        expect(posts()).toHaveLength(1);
        expect(focused()).toEqual([]);
    });

    it('moves a span with Move to… out of the focused field’s highlight and into the target’s', async () => {
        const { stores, focused } = await open();
        const field = () => screen.getByRole('toolbar', { name: /^actions on Spatial scope/ });
        fireEvent.click(within(field()).getByRole('button', { name: 'Move to…' }));
        fireEvent.change(screen.getByRole('combobox', { name: 'move this evidence to' }), {
            target: { value: 'Group 3 · n' },
        });
        fireEvent.click(screen.getByRole('option', { name: 'Group 3 · n' }));
        expect(focused()).toEqual([]);
        await saved();
        expect(posts()).toHaveLength(1);
        expect(focused()).toEqual([]);
        act(() => stores.view.getState().focusSlot('slot:grp_3:n'));
        expect(focused()).toEqual([at('Within these ROIs'), whole]);
    });
});
