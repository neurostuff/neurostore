import { getContrastRatio } from '@mui/material/styles';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { cardLayoutOf } from '../model/cardLayout';
import { comparisonSlots } from '../model/comparison';
import { ReviewScreen } from '../review/ReviewScreen';
import { registeredSpans } from '../test/highlights';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { makeTheme } from '../theme';
import { Inspector } from './FocusedCard';
import { STATUSES, underlines } from './status';

const TEXT = 'x'.repeat(300);

const gender = (category: string, count: number, percentage: number, denominator: number) => ({
    category: ev(category, [[10, 16]]),
    count: ev(count, [[20, 22]]),
    percentage: ev(percentage, [[30, 34]]),
    denominator: ev(denominator, [[40, 42]]),
    reporting_framework: ev('Gender'),
});

const analysis = (i: number, n: number) => ({
    local_id: `a_${i}`,
    name: ev(`Analysis ${i}`),
    prespecification: ev('planned', [[50, 57]]),
    outcome: ev('significant_effect'),
    spatial_scope: notReported('not_in_text'),
    definition: ev('LTMs had less gray matter volume than MNPs.', [[60, 70]]),
    groups: [{ group: 'grp_a', n: ev(n) }],
    measure: 'mea_1',
});

const record = {
    groups: [
        {
            local_id: 'grp_a',
            name: ev('LTMs', [[0, 4]]),
            species: ev('human'),
            acquired_count: ev(28, [[5, 7]]),
            age_mean: ev(52.5),
            approached_count: notReported('not_in_text'),
            age_median: notReported(),
            gender_distribution: [gender('Female', 15, 53.6, 28), gender('Male', 13, 46.4, 28)],
        },
    ],
    measures: [{ local_id: 'mea_1', source_label: ev('GMV') }],
    analyses: [22, 28, 22, 22, 28, 22, 22, 22].map((n, i) => analysis(i + 1, n)),
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('mea_1', 'Measure', 'measures'),
    ...record.analyses.map((a) => row(a.local_id, 'Analysis', 'analyses'))
);

function setup(entity = 'grp_a') {
    const view = renderWithStores(<Inspector />, makeBundle(record, TEXT, { entities }));
    act(() => view.stores.view.getState().focusEntity(entity));
    return { ...view, view: () => view.stores.view.getState() };
}

const valueOf = (key: string) => document.querySelector<HTMLElement>(`[data-slot-key="${key}"]`)!;
const selected = () => screen.getByRole('region', { name: 'Selected field' });

describe('a distribution on a card', () => {
    it('is one line, the shared denominator said once', () => {
        setup();
        const line = screen.getByRole('group', { name: 'Gender' });
        expect(line).toHaveTextContent(/^GenderFemale.*15.*\(53\.6.*%\) · Male.*13.*\(46\.4.*%\) of 28/);
        expect(within(line).getAllByText('28')).toHaveLength(1);
    });

    it('focuses an item’s percentage from a click on it, its fields together in the details', () => {
        const { view } = setup();
        fireEvent.click(screen.getByRole('button', { name: '53.6' }));
        expect(view().focus.slot).toBe('slot:grp_a:gender_distribution[#0].percentage');
        expect(valueOf('slot:grp_a:gender_distribution[#0].percentage')).toHaveAttribute('aria-current', 'true');
        const fields = within(selected()).getByRole('group', { name: /^fields of / });
        expect(within(fields).getByText('category')).toBeInTheDocument();
        expect(within(fields).getByText('Female')).toBeInTheDocument();
        expect(within(fields).getByText('reporting framework')).toBeInTheDocument();
        expect(selected()).toHaveTextContent('15 of 28 is 53.6%: matches');
    });

    it('marks a count and percentage that disagree with the denominator, and says why', () => {
        const wrong = {
            ...record,
            groups: [{ ...record.groups[0], gender_distribution: [gender('Female', 15, 60, 28)] }],
        };
        const view = renderWithStores(<Inspector />, makeBundle(wrong, TEXT, { entities }));
        act(() => view.stores.view.getState().focusEntity('grp_a'));
        expect(screen.getByRole('img', { name: 'count and percentage disagree' })).toHaveTextContent('⚠');
        fireEvent.click(screen.getByRole('button', { name: '60' }));
        expect(selected()).toHaveTextContent('15 of 28 is 53.6%: doesn’t match 60%');
    });

    it('says each denominator where the items differ', () => {
        const differ = {
            ...record,
            groups: [
                {
                    ...record.groups[0],
                    gender_distribution: [gender('Female', 15, 53.6, 28), gender('Male', 13, 43.3, 30)],
                },
            ],
        };
        const view = renderWithStores(<Inspector />, makeBundle(differ, TEXT, { entities }));
        act(() => view.stores.view.getState().focusEntity('grp_a'));
        const line = screen.getByRole('group', { name: 'Gender' });
        expect(within(line).getByText('28')).toBeInTheDocument();
        expect(within(line).getByText('30')).toBeInTheDocument();
        expect(line).not.toHaveTextContent(/\) of 28/);
    });
});

describe('the n each analysis analysed of a group', () => {
    it('is grouped by value, and each value opens its analyses', () => {
        const { view } = setup();
        const analysed = screen.getByRole('group', { name: 'analysed n' });
        expect(
            within(analysed)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(['22 in 6 analyses', '28 in 2 analyses']);
        fireEvent.click(within(analysed).getByRole('button', { name: '28 in 2 analyses' }));
        const list = within(selected()).getByRole('list', { name: 'analyses with n 28' });
        expect(
            within(list)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(['Analysis 2 →', 'Analysis 5 →']);
        fireEvent.click(within(list).getByRole('button', { name: 'open Analysis 5' }));
        expect(view().focus.key).toBe('slot:a_5:groups[#0].n');
    });
});

describe('focusing a value', () => {
    it('shows its details below the fields', () => {
        const { view } = setup('a_1');
        fireEvent.click(screen.getByRole('button', { name: 'planned' }));
        expect(view().focus.slot).toBe('slot:a_1:prespecification');
        expect(selected()).toHaveTextContent(/^Selected · About · Prespecification/);
        expect(selected()).toHaveTextContent('evidence 1 of 1 highlighted in the text');
        expect(within(selected()).getByRole('toolbar', { name: 'actions on Prespecification' })).toBeInTheDocument();
    });

    it('highlights its evidence in the text', () => {
        const view = renderWithStores(<ReviewScreen />, makeBundle(record, TEXT, { entities }));
        act(() => view.stores.view.getState().setStep('entities'));
        act(() => view.stores.view.getState().focusEntity('grp_a'));
        fireEvent.click(within(valueOf('slot:grp_a:acquired_count')).getByRole('button', { name: '28' }));
        expect(registeredSpans('rv-focus', view.textRoot())).toEqual([[5, 7]]);
    });

    it('walks the values with j and k from the card head, the title first, the fold skipped until it is open', () => {
        const { view } = setup('a_1');
        const walk = () => {
            const seen: string[] = [];
            for (;;) {
                const before = view().focus.key;
                act(() => view().moveSlot(1));
                if (view().focus.key === before) return seen;
                seen.push(view().focus.slot!.replace('slot:a_1:', ''));
            }
        };
        expect(walk()).toEqual([
            'name',
            'prespecification',
            'outcome',
            'definition',
            'measure',
            'groups[#0].group',
            'groups[#0].n',
            'model_estimation',
            'inference_settings',
            'regions',
            'defines_regions',
            'acquisitions',
            'tasks',
            'assessments',
            'tables',
            'mirror_of',
        ]);
        act(() => view().moveSlot(-1));
        expect(view().focus.slot).toBe('slot:a_1:tables');
        act(() => view().focusSlot('slot:a_1:mirror_of'));
        fireEvent.click(screen.getByRole('button', { name: /more fields/ }));
        act(() => view().moveSlot(1));
        expect(view().focus.slot).toBe('slot:a_1:effect.kind');
    });

    it('selects a link from its chip, and the details open its entity', () => {
        const { view } = setup('a_1');
        fireEvent.click(within(valueOf('slot:a_1:measure')).getByRole('button', { name: 'GMV' }));
        expect(view().focus).toEqual({
            entity: 'a_1',
            key: 'relationship:a_1:measure:mea_1',
            slot: 'slot:a_1:measure',
        });
        fireEvent.click(within(selected()).getByRole('button', { name: 'GMV' }));
        expect(view().focus.key).toBe('relationship:a_1:measure:mea_1');
        fireEvent.click(within(selected()).getByRole('button', { name: 'open GMV' }));
        expect(view().focus).toEqual({ entity: 'mea_1', key: 'entity:mea_1' });
    });

    it('focuses the name from the card’s title', () => {
        const { view } = setup('a_1');
        fireEvent.click(within(screen.getByRole('heading', { name: 'Analysis 1' })).getByRole('button'));
        expect(view().focus.slot).toBe('slot:a_1:name');
        expect(selected()).toHaveTextContent(/^Selected · Title · Name/);
        expect(screen.queryByText('Name', { selector: '.rv-row-label' })).not.toBeInTheDocument();
    });
});

describe('a value still to check', () => {
    it('is dashed until a reviewer judges it, and an empty link is a dashed none', () => {
        const { stores, view } = setup('a_1');
        const text = () => valueOf('slot:a_1:prespecification').querySelector('.rv-value-text')!;
        expect(text()).toHaveAttribute('data-unchecked', 'true');
        act(() => view().focusSlot('slot:a_1:prespecification'));
        fireEvent.click(within(selected()).getByRole('button', { name: 'Accept' }));
        expect(stores.session.getState().provenance['slot:a_1:prespecification']?.state).toBe('verified');
        expect(text()).not.toHaveAttribute('data-unchecked');
        const none = within(valueOf('slot:a_1:regions')).getByRole('button', { name: 'none' });
        expect(getComputedStyle(none).borderStyle).toBe('dashed');
    });
});

describe('a distribution item', () => {
    it('is edited from its details: Edit and Save on its count send one set_value', () => {
        const { stores } = setup();
        fireEvent.click(within(valueOf('slot:grp_a:gender_distribution[#0].count')).getByRole('button'));
        fireEvent.click(within(selected()).getByRole('button', { name: 'Edit' }));
        fireEvent.change(within(selected()).getByRole('spinbutton'), { target: { value: '16' } });
        fireEvent.click(within(selected()).getByRole('button', { name: 'Save' }));
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({
                type: 'set_value',
                target: { kind: 'slot', entity: 'grp_a', path: 'gender_distribution[#0].count' },
                value: expect.objectContaining({ value: 16 }),
            }),
        ]);
    });
});

describe('the fold', () => {
    it('holds the fields not reported or not in the record, the ambiguous kept out', () => {
        setup();
        const fold = screen.getByRole('button', { name: /more fields \(not reported or not in the record\)/ });
        expect(fold).toHaveAttribute('aria-expanded', 'false');
        expect(valueOf('slot:grp_a:approached_count')).toBeNull();
        expect(valueOf('slot:grp_a:age_median')).not.toBeNull();
        fireEvent.click(fold);
        expect(valueOf('slot:grp_a:approached_count')).toHaveTextContent('not reported (not_in_text)');
    });

    it('stays open for the class on this device, on the next card of the class and not on another class’s', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: /more fields/ }));
        cleanup();
        const again = renderWithStores(<Inspector />, makeBundle(record, TEXT, { entities }));
        act(() => again.stores.view.getState().focusEntity('grp_a'));
        expect(screen.getByRole('button', { name: /more fields/ })).toHaveAttribute('aria-expanded', 'true');
        expect(valueOf('slot:grp_a:approached_count')).not.toBeNull();
        act(() => again.stores.view.getState().focusEntity('a_1'));
        expect(screen.getByRole('button', { name: /more fields/ })).toHaveAttribute('aria-expanded', 'false');
    });
});

const P5: ReviewBundle = JSON.parse(readFileSync(path.resolve(__dirname, '../../e2e/fixtures/P5.bundle.json'), 'utf8'));

describe.each(['grp_a', 'an_1'])('the card of P5’s %s, its fold open', (id) => {
    it('shows each slot once outside the comparison and the selection’s details', () => {
        const { stores } = renderWithStores(<Inspector />, P5);
        act(() => stores.view.getState().focusEntity(id));
        fireEvent.click(screen.getByRole('button', { name: /more fields/ }));
        const card = screen.getByRole('region', { name: stores.session.getState().index.entity(id)!.name });
        const outside = [...card.querySelectorAll('[data-slot-key]')].filter(
            (el) => !el.closest('[aria-label="What is compared"], [aria-label="Selected field"]')
        );
        const counts = new Map<string, number>();
        for (const el of outside)
            counts.set(el.getAttribute('data-slot-key')!, (counts.get(el.getAttribute('data-slot-key')!) ?? 0) + 1);
        expect([...counts].filter(([, n]) => n > 1)).toEqual([]);
        const { index } = stores.session.getState();
        const entity = index.entity(id)!;
        const layout = cardLayoutOf(index, entity);
        const comparison = new Set(comparisonSlots(index, entity).map((s) => s.key));
        const walked = [...layout.order, ...layout.folded].map((s) => s.key).filter((key) => !comparison.has(key));
        expect(
            walked.filter(
                (key) => !counts.has(key) && !layout.places.get(key)?.item?.detailsOnly.some((s) => s.key === key)
            )
        ).toEqual([]);
    });
});

describe.each(['light', 'dark'] as const)('the marks and underlines, %s', (mode) => {
    const t = makeTheme(mode);
    it('read at 3:1 or more on the field surface', () => {
        const colours = [
            ...Object.entries(STATUSES).map(([id, status]) => [id, status.color(t.palette)] as const),
            ...Object.entries(underlines(t.palette)),
            ['warning', t.palette.sign.missing.text] as const,
        ];
        expect(
            colours.filter(([, colour]) => getContrastRatio(colour, t.palette.fieldSurface) < 3).map(([id]) => id)
        ).toEqual([]);
    });
});
