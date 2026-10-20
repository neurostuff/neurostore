import { act, fireEvent, screen, within } from '@testing-library/react';
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

const indicator = () => screen.getByRole('status', { name: /^save state/ });

describe('the save indicator', () => {
    it('says saved, N unsaved, saving or offline in its label and tooltip', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        expect(indicator()).toHaveAccessibleName('save state: saved');
        expect(indicator()).toHaveAttribute('title', 'saved');
        act(() => stores.session.setState({ pending: [op, op] }));
        expect(indicator()).toHaveAccessibleName('save state: 2 unsaved');
        act(() => stores.session.setState({ save: 'saving' }));
        expect(indicator()).toHaveAccessibleName('save state: saving');
        act(() => stores.session.setState({ save: 'offline' }));
        expect(indicator()).toHaveAccessibleName('save state: offline');
    });

    it('is an icon of one fixed width, with no text to push the header about', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        expect(indicator()).toHaveTextContent('');
        const width = getComputedStyle(indicator()).width;
        expect(width).toBe('28px');
        act(() => stores.session.setState({ save: 'offline' }));
        expect(getComputedStyle(indicator()).width).toBe(width);
        expect(indicator()).toHaveTextContent('');
    });
});

describe('a refused save', () => {
    it('shows the error in red', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        act(() =>
            stores.session.setState({
                blocked: { clientOpIds: [], problems: ['the batch leaves an invalid document'], reason: 'refused' },
                saveMessage: 'the batch leaves an invalid document',
            })
        );
        expect(indicator()).toHaveAccessibleName('save state: the batch leaves an invalid document');
        expect(indicator()).toHaveStyle({ color: theme.palette.error.main });
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
        expect(indicator()).toHaveAccessibleName('save state: sign in to save');
        client.stop();
    });
});

describe('save notices', () => {
    it('name a refused link by its ends in the reviewer’s terms, not its key (G3)', () => {
        const linked = makeBundle(
            {
                analyses: [{ local_id: 'a_1', name: ev('Patients > Controls'), acquisitions: [] }],
                acquisitions: [{ local_id: 'acq_1', name: ev('fMRI') }],
            },
            'Text of the paper.',
            { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('acq_1', 'Acquisition', 'acquisitions')) }
        );
        const { stores } = renderWithStores(<SaveNotices />, linked);
        const op: Op = {
            client_op_id: 'op-link',
            type: 'link',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        };
        act(() => stores.session.getState().emit(op));
        act(() => stores.session.getState().refuse([{ op, message: 'structural edits need the server' }]));
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent(
            'Couldn’t link Patients > Controls · Acquisitions → fMRI: the server refused this edit (structural edits need the server)'
        );
        expect(banner).not.toHaveTextContent('relationship:');
    });

    const listedBundle = () =>
        makeBundle({ analyses: [{ local_id: 'a_1', name: ev('Patients > Controls') }] }, 'Text of the paper.', {
            entities: entityRows(row('a_1', 'Analysis', 'analyses')),
        });
    const creating = (client_op_id: string): Op => ({
        client_op_id,
        type: 'create_entity',
        parent: 'study',
        list: 'analyses',
        entity: {},
    });
    const required = (name: string) => `extraction-record /analyses/1: '${name}' is a required property`;
    const linesOf = () => within(screen.getByRole('status')).getAllByRole('listitem');

    it('group the problems of one refused op into one line, the raw problems behind details', () => {
        const { stores } = renderWithStores(<SaveNotices />, listedBundle());
        const op = creating('op-create');
        const raw = ['measure', 'groups', 'effect', 'details', 'model_estimation'].map(required);
        act(() => stores.session.getState().refuse(raw.map((message) => ({ op, message }))));
        const lines = linesOf();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toHaveTextContent(
            /^Couldn’t add the analysis: the server needs measure, groups, effect, details and model estimation\./
        );
        const details = within(lines[0]).getByText('details').closest('details')!;
        expect(details).not.toHaveAttribute('open');
        expect(details).toHaveTextContent(raw.join(''));
    });

    it('say what the server needs, then its other problems, on one op’s line', () => {
        const { stores } = renderWithStores(<SaveNotices />, listedBundle());
        const op = creating('op-create');
        const raw = [required('measure'), 'extraction-record /analyses/1/name: must be object'];
        act(() => stores.session.getState().refuse(raw.map((message) => ({ op, message }))));
        expect(linesOf()[0]).toHaveTextContent(
            /^Couldn’t add the analysis: the server needs measure\. the server refused this edit \(extraction-record \/analyses\/1\/name: must be object\)details/
        );
    });

    it('group the problems of a refused edit that creates nothing, by its target', () => {
        const { stores } = renderWithStores(<SaveNotices />, listedBundle());
        const op: Op = {
            client_op_id: 'op-name',
            type: 'set_value',
            target: { kind: 'slot', entity: 'a_1', path: 'name' },
            value: { extraction_status: 'extracted', value: 'x', value_source: 'reported' },
        };
        const raw = ['first problem', 'second problem'];
        act(() => stores.session.getState().refuse(raw.map((message) => ({ op, message }))));
        const lines = linesOf();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toHaveTextContent(
            /^Couldn’t set Patients > Controls · Name: the server refused this edit \(first problem; second problem\)/
        );
        expect(within(lines[0]).getByText('details')).toBeInTheDocument();
    });

    it('put two refused ops on two lines', () => {
        const { stores } = renderWithStores(<SaveNotices />, listedBundle());
        const [one, two] = [creating('op-one'), creating('op-two')];
        act(() =>
            stores.session.getState().refuse([
                { op: one, message: required('measure') },
                { op: two, message: required('groups') },
                { op: one, message: required('effect') },
            ])
        );
        const lines = linesOf();
        expect(lines).toHaveLength(2);
        expect(lines[0]).toHaveTextContent(/the server needs measure and effect\./);
        expect(lines[1]).toHaveTextContent(/the server needs groups\./);
    });

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

describe('the device notice', () => {
    it('says how this tab keeps its edits, apart from the dismissable notices', () => {
        const { stores } = renderWithStores(<SaveNotices />, bundle);
        act(() => stores.session.getState().setDevice('readonly', 'open in another tab: this one is read-only'));
        expect(screen.getByRole('note')).toHaveTextContent('open in another tab: this one is read-only');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        act(() => stores.session.getState().setDevice('kept', ''));
        expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });
});

describe('the save state while offline', () => {
    it('says the edits are saved on this device when it keeps them', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, bundle);
        act(() => {
            stores.session.getState().setDevice('kept');
            stores.session.getState().setSave('offline');
        });
        expect(indicator()).toHaveAccessibleName('save state: offline; saved on this device');
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

    it('says what the toggle means, and shows the toggle filled while on', () => {
        const { stores } = renderWithStores(<ReviewAppBar />, withAnalysis);
        const toggle = screen.getByRole('button', { name: 'non-coordinate analyses' });
        expect(toggle.parentElement).toHaveAttribute(
            'title',
            'Show or hide the 1 analysis with no coordinates, on the Coordinates and Analyses steps (Shift+H)'
        );
        expect(toggle).toHaveClass('MuiButton-outlined');
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(screen.getByRole('button', { name: 'non-coordinate analyses' })).toHaveClass('MuiButton-contained');
    });

    it('is greyed out, still saying what it does, when the paper has none', () => {
        renderWithStores(<ReviewAppBar />, makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.'));
        const toggle = screen.getByRole('button', { name: 'non-coordinate analyses' });
        expect(toggle).toBeDisabled();
        expect(toggle.parentElement).toHaveAttribute(
            'title',
            'This paper has no analyses without coordinates; when one has, this shows or hides them (Shift+H)'
        );
    });

    it('counts no slots of the record: the step bar counts what each step asks', () => {
        renderWithStores(<ReviewAppBar />, withAnalysis);
        expect(screen.getByRole('banner')).not.toHaveTextContent(/reviewed/);
    });
});

describe('the reviewers who have edited the paper', () => {
    it('lists each reviewer with ops, their op count, last edit and its exact time, on the review state’s hover', () => {
        const lastEdit = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const edited = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
            reviewers: [
                { user_id: 'ana', name: 'Ana', state: 'in_progress', op_count: 3, last_edit_at: lastEdit },
                { user_id: 'ben', name: 'Ben', state: 'in_progress', op_count: 0, last_edit_at: null },
            ],
        });
        renderWithStores(<ReviewAppBar />, edited);
        const state = screen.getByLabelText(/^review state/);
        expect(state.closest('[title]')).toHaveAttribute(
            'title',
            `new review. Ana: last edit 2 h ago, 3 ops (${new Date(lastEdit).toLocaleString()})`
        );
        expect(state.closest('[title]')?.getAttribute('title')).not.toMatch(/Ben/);
    });
});

describe('the copy the text was read from', () => {
    const withCopy = (text_copy: unknown) =>
        makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
            parsed_paper: { bibliography: { title: 'A paper' }, text_copy },
        });

    it.each([
        [{ version: 'vor', license: { license_id: 'cc-by', determination: 'stated' } }, 'VoR · CC-BY'],
        [
            { version: 'submitted', license: { license_id: 'all-rights-reserved', determination: 'assumed' } },
            'submitted manuscript · all rights reserved',
        ],
        [
            { version: 'am', license: { license_id: 'cc-by-nc-nd', determination: 'stated' } },
            'accepted manuscript · CC-BY-NC-ND',
        ],
        [{ license: { license_id: 'cc0', determination: 'stated' } }, 'version unknown · CC0'],
        [{ version: 'vor' }, 'VoR · licence unknown'],
        [{ version: 'vor', license: { determination: 'assumed' } }, 'VoR · licence unknown'],
        [{ version: 'vor', license: { license_id: 'public-domain' } }, 'VoR · public domain'],
        [{ version: 'vor', license: { license_id: 'other' } }, 'VoR · other licence'],
    ])('names its version and licence', (copy, note) => {
        renderWithStores(<ReviewAppBar />, withCopy(copy));
        expect(screen.getByLabelText(/^text copy/)).toHaveTextContent(note);
    });

    it('shows the licence as the paper states it on hover', () => {
        const stated_as = 'https://creativecommons.org/licenses/by/4.0/';
        renderWithStores(<ReviewAppBar />, withCopy({ version: 'vor', license: { license_id: 'cc-by', stated_as } }));
        expect(screen.getByLabelText(/^text copy/)).toHaveAttribute('title', stated_as);
    });

    it('has no hover text when the licence is not stated as anything', () => {
        renderWithStores(
            <ReviewAppBar />,
            withCopy({ version: 'vor', license: { license_id: 'cc-by', stated_as: null } })
        );
        expect(screen.getByLabelText(/^text copy/)).not.toHaveAttribute('title');
    });

    it('is not named when the parsed paper has no copy', () => {
        renderWithStores(<ReviewAppBar />, bundle);
        expect(screen.queryByLabelText(/^text copy/)).not.toBeInTheDocument();
    });
});
