import { Box, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ReactNode } from 'react';
import {
    comparisonOf,
    DIRECTION_SIDES,
    entriesOf,
    levelText,
    SIDE_ORDER,
    type LevelEntry,
    type Side,
    type TermRow,
} from '../model/comparison';
import { counted, labelOf } from '../model/labels';
import type { EntityNode } from '../model/record';
import { useSession, useView } from '../store/context';
import { FieldAbout } from './FieldAbout';
import { fieldHint } from './fieldHint';
import { SlotBody, SlotHead } from './SlotParts';
import { slotStyles } from './slotStyles';
import { reviewStatus, STATUSES } from './status';
import { StatusMark } from './StatusLabel';
import { useScrollIntoViewWhen } from './useScrollIntoViewWhen';

/** Each side in words: its mark before a level, its choice in the direction editor, and a continuous term's way. */
const SIDE_WORDS: Record<Side, { mark: string; choice: string; way: string }> = {
    positive: { mark: '+', choice: '+ greater', way: '↑ greater with more' },
    negative: { mark: '−', choice: '− less', way: '↓ less with more' },
    held: { mark: 'held at', choice: 'held', way: 'held' },
    either: { mark: '', choice: 'either way', way: 'either way' },
    missing: { mark: '', choice: '', way: 'sign missing' },
};

/** A direction's values in the comparison's words, for its editor. */
const DIRECTION_CHOICES = Object.fromEntries(
    Object.entries(DIRECTION_SIDES).map(([direction, side]) => [direction, SIDE_WORDS[side].choice])
);

const MISSING = <span className="rv-missing-sign">{SIDE_WORDS.missing.way}</span>;

/**
 * One cell as a chip: a click focuses its direction; `name` and its review status are its accessible name, and its
 * direction's description its hover hint.
 */
const SignChip = memo(function SignChip({
    entry,
    side,
    name,
    children,
}: {
    entry: LevelEntry;
    side: Side;
    name: string;
    children: ReactNode;
}) {
    const key = entry.slots.direction;
    const status = reviewStatus(useSession((s) => s.provenance[key]?.state));
    const focused = useView((s) => s.focus.slot === key);
    const focusSlot = useView((s) => s.focusSlot);
    const hint = useSession((s) => {
        const slot = s.index.slot(key);
        return slot && fieldHint(s.index, slot);
    });
    const ref = useScrollIntoViewWhen<HTMLButtonElement>(focused);
    return (
        <button
            ref={ref}
            type="button"
            className={`rv-chip rv-${side}`}
            data-slot-key={key}
            aria-current={focused ? 'true' : undefined}
            aria-label={`${name}, ${STATUSES[status].label}`}
            title={hint}
            onClick={() => focusSlot(key)}
        >
            {children}
            <StatusMark id={status} />
        </button>
    );
});

/** The greater or less levels of a term: one chip, or how many, then a chip for each. */
function Signed({ row, side }: { row: TermRow; side: 'positive' | 'negative' }) {
    const { mark } = SIDE_WORDS[side];
    const entries = row[side];
    const chip = (entry: LevelEntry, text: string) => (
        <SignChip key={entry.cell} entry={entry} side={side} name={`${mark} ${levelText(row, entry)}`}>
            {text}
        </SignChip>
    );
    if (entries.length === 0) return null;
    if (entries.length === 1) return chip(entries[0], `${mark} ${levelText(row, entries[0])}`);
    return (
        <span className={`rv-side rv-${side}`}>
            <span className="rv-side-count">{`${mark} ${entries.length} levels`}</span>
            <span className="rv-side-levels">{entries.map((entry) => chip(entry, levelText(row, entry)))}</span>
        </span>
    );
}

/** The levels a categorical term has on `side`. */
function OnSide({ row, side }: { row: TermRow; side: Side }) {
    const entries = row[side];
    switch (side) {
        case 'positive':
        case 'negative':
            return <Signed row={row} side={side} />;
        case 'held':
            return entries.map((entry) => {
                const text = `${SIDE_WORDS.held.mark} ${levelText(row, entry)}`;
                return (
                    <SignChip key={entry.cell} entry={entry} side={side} name={text}>
                        {text}
                    </SignChip>
                );
            });
        case 'either':
            return entries.length === 0 ? null : (
                <span className="rv-either-group">
                    {entries.map((entry) => (
                        <SignChip
                            key={entry.cell}
                            entry={entry}
                            side={side}
                            name={`${levelText(row, entry)} ${SIDE_WORDS.either.way}`}
                        >
                            {levelText(row, entry)}
                        </SignChip>
                    ))}
                    <span className="rv-either-word">{SIDE_WORDS.either.way}</span>
                </span>
            );
        case 'missing':
            return entries.map((entry) => (
                <SignChip
                    key={entry.cell}
                    entry={entry}
                    side={side}
                    name={`${levelText(row, entry)}, ${SIDE_WORDS.missing.way}`}
                >
                    {levelText(row, entry)}
                    {MISSING}
                </SignChip>
            ));
    }
}

/** A continuous term's cells, in the comparison's order, each by which way it goes. */
function Ways({ row }: { row: TermRow }) {
    return SIDE_ORDER.flatMap((side) =>
        row[side].map((entry) => (
            <SignChip
                key={entry.cell}
                entry={entry}
                side={side}
                name={
                    side === 'missing'
                        ? `${row.termLabel}, ${SIDE_WORDS.missing.way}`
                        : `${row.termLabel} ${SIDE_WORDS[side].way}`
                }
            >
                {side === 'missing' ? MISSING : SIDE_WORDS[side].way}
            </SignChip>
        ))
    );
}

function Term({ row }: { row: TermRow }) {
    return (
        <div role="group" aria-label={row.termLabel} className="rv-term">
            <span className="rv-term-name">{row.termLabel}</span>
            <span className="rv-sides">
                {row.continuous ? (
                    <Ways row={row} />
                ) : (
                    SIDE_ORDER.map((side) => <OnSide key={side} row={row} side={side} />)
                )}
            </span>
        </div>
    );
}

/** The focused cell's direction: its field head, then its field actions, or the panel open on it. */
function FocusedSign({ slotKey }: { slotKey: string }) {
    const slot = useSession((s) => s.index.slot(slotKey));
    const label = useSession((s) => (slot ? labelOf(s.index, slot) : ''));
    const panel = useView((s) => (s.panel?.slot === slotKey ? s.panel : null));
    if (!slot) return null;
    return (
        <div className="rv-focused-sign">
            <SlotHead slot={slot} label={label} />
            <FieldAbout slot={slot} />
            <SlotBody slot={slot} label={label} panel={panel} valueLabels={DIRECTION_CHOICES} />
        </div>
    );
}

const comparisonStyles = (theme: Theme) => {
    const { sign } = theme.palette;
    const tinted = (colours: { text: string; surface: string }) => ({ color: colours.text, bgcolor: colours.surface });
    return {
        ...slotStyles(theme),
        px: 2,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '& .rv-headline': { typography: 'subtitle1', fontWeight: 500, m: 0, overflowWrap: 'anywhere' },
        '& .rv-qualifier': { fontWeight: 400, color: 'text.secondary' },
        '& .rv-missing-count': { typography: 'caption', fontWeight: 700, color: sign.missing.text },
        '& .rv-term': {
            display: 'grid',
            gridTemplateColumns: '110px minmax(0, 1fr)',
            columnGap: 1.25,
            alignItems: 'start',
        },
        '& .rv-term-name': { typography: 'body2', color: 'text.secondary', overflowWrap: 'anywhere', pt: 0.5 },
        '& .rv-sides': { display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'flex-start' },
        '& .rv-chip': {
            typography: 'body2',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.5,
            border: 1,
            borderColor: 'transparent',
            borderRadius: 1,
            cursor: 'pointer',
            color: 'text.primary',
            bgcolor: 'transparent',
            textAlign: 'start',
            overflowWrap: 'anywhere',
        },
        '& .rv-chip[aria-current="true"]': { outline: 2, outlineColor: theme.palette.primary.main, outlineOffset: 1 },
        '& .rv-positive': tinted(sign.greater),
        '& .rv-negative': tinted(sign.less),
        '& .rv-held': { borderStyle: 'dashed', borderColor: 'text.secondary', fontWeight: 400 },
        '& .rv-either': { borderColor: 'text.secondary' },
        '& .rv-missing': { borderColor: sign.missing.text, bgcolor: sign.missing.surface },
        '& .rv-missing-sign': { color: sign.missing.text, fontWeight: 700 },
        '& .rv-side': { display: 'flex', flexDirection: 'column', gap: 0.25, borderRadius: 1, px: 1, py: 0.5 },
        '& .rv-side-count': { typography: 'body2', fontWeight: 700 },
        '& .rv-side-levels': { display: 'flex', flexWrap: 'wrap', gap: 0.25 },
        '& .rv-side .rv-chip': { px: 0.5, py: 0.25 },
        '& .rv-either-group': { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 },
        '& .rv-either-word': { typography: 'body2', color: 'text.secondary' },
        '& .rv-focused-sign': { borderLeft: 3, borderColor: 'primary.main', pl: 1.5, py: 0.5 },
    };
};

/** What the analysis compares: its headline, then one row per term, each level a chip of its cell's direction. */
export const ComparisonSection = memo(function ComparisonSection({ entity }: { entity: EntityNode }) {
    const { headline, rows } = useSession((s) => comparisonOf(s.index, entity));
    const focusedSlot = useView((s) => s.focus.slot);
    if (rows.length === 0 && !headline) return null;
    const missing = rows.reduce((n, row) => n + row.missing.length, 0);
    const focused = rows.flatMap(entriesOf).find((entry) => entry.slots.direction === focusedSlot);
    return (
        <Box component="section" aria-label="What is compared" sx={comparisonStyles}>
            <Typography variant="overline" component="div" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                What is compared
            </Typography>
            {headline && (
                <h3 className="rv-headline">
                    {headline.text}
                    {headline.qualifier && <span className="rv-qualifier">{` ${headline.qualifier}`}</span>}
                </h3>
            )}
            {missing > 0 && <span className="rv-missing-count">{`${counted(missing, 'sign')} missing`}</span>}
            {rows.map((row) => (
                <Term key={row.term} row={row} />
            ))}
            {focused && <FocusedSign slotKey={focused.slots.direction} />}
        </Box>
    );
});
