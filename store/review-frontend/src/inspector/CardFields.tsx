import { Box, Typography } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { memo, useMemo, useState } from 'react';
import { analysedByN } from '../model/analysed';
import {
    cardLayoutOf,
    checkDistribution,
    type CardLayout,
    type Chip,
    type ItemOf,
    type LinkGroup,
    type Piece,
    type Row,
} from '../model/cardLayout';
import { counted, inWords, labelOf, plural } from '../model/labels';
import type { EntityNode, SlotNode } from '../model/record';
import { relationshipKey } from '../model/targetKey';
import { valueWords } from '../model/valueText';
import { selectNotes } from '../review/outline';
import { useIsEditable, useReviewStores, useSession, useSessionView, useShown, useView } from '../store/context';
import { selectEvidenceCursor, selectFocusedSpans } from '../store/viewSelectors';
import { pendingLinks, unlink } from './actions';
import { NoteMark } from './NoteMark';
import { chipStyle, OpenButton, openStyles } from './OpenButton';
import { openPanelOn } from './openPanel';
import { RemoveIcon } from './RemoveIcon';
import { SlotBody, SlotHead } from './SlotParts';
import { slotHeadStyles } from './slotStyles';
import { reviewStatus, statusColors, statusOf, underlines } from './status';
import { StatusMark } from './StatusLabel';
import { useScrollIntoViewWhen } from './useScrollIntoViewWhen';
import { ValueView } from './ValueView';

/** A slot's marks: its evidence status, but for a reference, then its review status and its notes. */
const SlotMarks = memo(function SlotMarks({ slot }: { slot: SlotNode }) {
    const reviewed = useSession((s) => s.provenance[slot.key]?.state);
    const notes = useSession((s) => selectNotes(s).get(slot.key)?.join('\n'));
    return (
        <span className="rv-marks">
            {slot.kind === 'value' && <StatusMark id={statusOf(slot)} explained />}
            <StatusMark id={reviewStatus(reviewed)} explained />
            {notes && <NoteMark notes={notes} />}
        </span>
    );
});

/** Focuses the slot on a click, and opens its editor, or its link picker, on a double click; not while a panel is open. */
function useSlotHandlers(slot: SlotNode) {
    const stores = useReviewStores();
    return {
        onClick: (event: { stopPropagation(): void }) => {
            event.stopPropagation();
            if (!stores.view.getState().panel) stores.view.getState().focusSlot(slot.key);
        },
        onDoubleClick: (event: { stopPropagation(): void }) => {
            event.stopPropagation();
            if (stores.view.getState().panel) return;
            stores.view.getState().focusSlot(slot.key);
            openPanelOn(stores, slot.kind === 'reference' ? 'link' : 'edit');
        },
    };
}

const useFocused = (slot: SlotNode) => useView((s) => s.focus.slot === slot.key);

/** A slot's words as a button, dashed while no reviewer has judged it, then its marks. */
function SlotValue({ slot, text, className }: { slot: SlotNode; text: string; className?: string }) {
    const unchecked = useSession((s) => !s.provenance[slot.key]);
    return (
        <>
            <button
                type="button"
                className={className ? `rv-value-text ${className}` : 'rv-value-text'}
                data-unchecked={unchecked || undefined}
                title={text}
            >
                {text}
            </button>
            <SlotMarks slot={slot} />
        </>
    );
}

/** A value of a sentence or chip, a click on it focusing its slot. */
const Value = memo(function Value({ slot, text }: { slot: SlotNode; text: string }) {
    const focused = useFocused(slot);
    const handlers = useSlotHandlers(slot);
    const ref = useScrollIntoViewWhen<HTMLSpanElement>(focused);
    return (
        <span
            ref={ref}
            className="rv-value"
            data-slot-key={slot.key}
            aria-current={focused ? 'true' : undefined}
            {...handlers}
        >
            <SlotValue slot={slot} text={text} />
        </span>
    );
});

function Pieces({ pieces }: { pieces: Piece[] }) {
    return pieces.map((piece, i) => {
        switch (piece.kind) {
            case 'text':
                return <span key={i}>{piece.text}</span>;
            case 'value':
                return <Value key={piece.slot.key} slot={piece.slot} text={piece.text} />;
            case 'warn':
                return (
                    <span key={i} className="rv-warn" role="img" aria-label="count and percentage disagree">
                        {piece.text}
                    </span>
                );
        }
    });
}

/** A field on one line: its label, its value cut to the line, its marks. */
const SlotRow = memo(function SlotRow({ label, slot, text }: { label: string; slot: SlotNode; text: string }) {
    const focused = useFocused(slot);
    const handlers = useSlotHandlers(slot);
    const ref = useScrollIntoViewWhen<HTMLDivElement>(focused);
    return (
        <div
            ref={ref}
            className="rv-row"
            data-slot-key={slot.key}
            aria-current={focused ? 'true' : undefined}
            {...handlers}
        >
            <span className="rv-row-label">{label}</span>
            <SlotValue slot={slot} text={text} className="rv-row-value" />
        </div>
    );
});

function LineRow({ row }: { row: Row }) {
    const [only] = row.pieces;
    if (row.pieces.length === 1 && only.kind === 'value')
        return <SlotRow label={row.label} slot={only.slot} text={only.text} />;
    return (
        <div className="rv-row rv-row-list" role="group" aria-label={row.label}>
            <span className="rv-row-label">{row.label}</span>
            <span className="rv-row-line">
                <Pieces pieces={row.pieces} />
            </span>
        </div>
    );
}

/** A link chip: a click or focus selects the link, so its details show below; the cross or Delete unlinks it. */
const LinkChip = memo(function LinkChip({
    chip,
    unlinking,
}: {
    chip: Extract<Chip, { kind: 'link' }>;
    unlinking: boolean;
}) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const focusLink = useView((s) => s.focusLink);
    const key = relationshipKey(chip.slot.entity, chip.slot.path, chip.target);
    const reviewed = useSession((s) => s.provenance[key]?.state);
    const focused = useView((s) => s.focus.key === key);
    const removable = editable && !unlinking;
    const name = unlinking ? `${chip.name} · unlinking` : chip.name;
    return (
        <span className="rv-link-chip" aria-current={focused ? 'true' : undefined}>
            <button
                type="button"
                className="rv-chip-name"
                aria-label={name}
                title={chip.target}
                aria-busy={unlinking || undefined}
                onFocus={() => focusLink(chip.slot.key, chip.target)}
                onClick={(event) => {
                    event.stopPropagation();
                    focusLink(chip.slot.key, chip.target);
                }}
                onKeyUp={(event) => {
                    if (removable && (event.key === 'Delete' || event.key === 'Backspace'))
                        void unlink(stores, chip.slot, chip.target);
                }}
            >
                {name}
                <StatusMark id={reviewStatus(reviewed)} explained />
            </button>
            {removable && (
                <RemoveIcon
                    label={`unlink ${chip.name}`}
                    className="rv-chip-remove"
                    onClick={(event) => {
                        event.stopPropagation();
                        void unlink(stores, chip.slot, chip.target);
                    }}
                />
            )}
        </span>
    );
});

function NoneChip({ slot }: { slot: SlotNode }) {
    const focused = useFocused(slot);
    const reviewed = useSession((s) => s.provenance[slot.key]?.state);
    return (
        <button
            type="button"
            className="rv-link-chip rv-none"
            aria-label="none"
            title="Nothing linked; double-click to link"
            aria-current={focused ? 'true' : undefined}
        >
            none
            <StatusMark id={reviewStatus(reviewed)} explained />
        </button>
    );
}

function EntityChip({ entity }: { entity: EntityNode }) {
    const focusEntity = useView((s) => s.focusEntity);
    return <OpenButton name={entity.name} title={entity.localId} onOpen={() => focusEntity(entity.id)} />;
}

/** The chips of a reference slot's links, as the card and the selection's details show them. */
function linkChips(index: { entity(id: string): EntityNode | undefined }, slot: SlotNode): Chip[] {
    return slot.references.length
        ? slot.references.map((target) => ({ kind: 'link', slot, target, name: index.entity(target)?.name ?? target }))
        : [{ kind: 'none', slot }];
}

/**
 * The chips of one reference slot, held together so a click or double click beside them is the slot's; a link being
 * made or taken away says so.
 */
function SlotChips({ slot, chips }: { slot: SlotNode; chips: Chip[] }) {
    const focused = useFocused(slot);
    const handlers = useSlotHandlers(slot);
    const index = useSession((s) => s.index);
    const pending = useSession((s) => s.pending);
    const { linking, unlinking } = useMemo(() => pendingLinks({ pending }, slot.key), [pending, slot.key]);
    const adding = linking.filter((id) => !slot.references.includes(id));
    return (
        <span className="rv-chips" data-slot-key={slot.key} aria-current={focused ? 'true' : undefined} {...handlers}>
            {chips.map((chip) =>
                chip.kind === 'link' ? (
                    <LinkChip key={chip.target} chip={chip} unlinking={unlinking.has(chip.target)} />
                ) : adding.length ? null : (
                    <NoneChip key="none" slot={slot} />
                )
            )}
            {adding.map((id) => (
                <span key={id} className="rv-link-chip" aria-busy>
                    {`${index.entity(id)?.name ?? id} · linking`}
                </span>
            ))}
        </span>
    );
}

function LinkGroupView({ group }: { group: LinkGroup }) {
    const [first] = group.chips;
    const held = first && (first.kind === 'link' || first.kind === 'none') ? first.slot : undefined;
    return (
        <span className="rv-link-group" role="group" aria-label={group.label}>
            <span className="rv-link-label">{group.label}</span>
            {held ? (
                <SlotChips slot={held} chips={group.chips} />
            ) : (
                group.chips.map((chip, i) =>
                    chip.kind === 'entity' ? (
                        <EntityChip key={chip.entity.id} entity={chip.entity} />
                    ) : (
                        <span key={i} className="rv-item-chip">
                            {chip.kind === 'item' && <Pieces pieces={chip.pieces} />}
                        </span>
                    )
                )
            )}
        </span>
    );
}

function FoldedRow({ slot }: { slot: SlotNode }) {
    const label = useSession((s) => labelOf(s.index, slot));
    const text = useShown((index) => valueWords(index, slot));
    return <SlotRow label={label} slot={slot} text={text} />;
}

function Fold({ entity, folded }: { entity: EntityNode; folded: SlotNode[] }) {
    const open = useView((s) => s.openFolds.includes(entity.schemaClass));
    const toggleFold = useView((s) => s.toggleFold);
    return (
        <div className="rv-fold">
            <button
                type="button"
                className="rv-fold-toggle"
                aria-expanded={open}
                title={open ? 'Hide these fields' : 'Show these fields, and walk them with j and k'}
                onClick={() => toggleFold(entity.schemaClass)}
            >
                {`${open ? '−' : '+'} ${counted(folded.length, 'more field')} (not reported or not in the record)`}
            </button>
            {open && (
                <div className="rv-rows" role="group" aria-label="more fields">
                    {folded.map((slot) => (
                        <FoldedRow key={slot.key} slot={slot} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Where the focused evidence span is among the focused item's, and the keys that step through them. */
function EvidenceStep() {
    const said = useSessionView((session, view) => {
        const spans = selectFocusedSpans(session, view).length;
        if (!spans) return 'no evidence highlighted';
        const at = selectEvidenceCursor(session, view) + 1;
        return `evidence ${at} of ${spans} highlighted in the text · ] and [ step through it`;
    });
    return <div className="rv-evidence">{said}</div>;
}

/** A field of the selected list item, beside the selected one: its name, its value and its marks. */
function ItemField({ slot, field }: { slot: SlotNode; field: string }) {
    const handlers = useSlotHandlers(slot);
    const focused = useFocused(slot);
    const text = useShown((index) => valueWords(index, slot));
    return (
        <>
            <span className="rv-row-label">{inWords(field)}</span>
            <span
                className="rv-value"
                data-slot-key={slot.key}
                aria-current={focused ? 'true' : undefined}
                {...handlers}
            >
                <SlotValue slot={slot} text={text} />
            </span>
        </>
    );
}

/** The selected item's other fields, those not reported behind a line of their own. */
function ItemFields({ item, selected }: { item: ItemOf; selected: string }) {
    const [open, setOpen] = useState(false);
    const folded = new Set(item.folded.map((slot) => slot.key));
    const fields = [...item.fields].filter(([, slot]) => slot.key !== selected);
    const shown = fields.filter(([, slot]) => open || !folded.has(slot.key));
    const hidden = fields.length - shown.length;
    return (
        <div className="rv-item-fields" role="group" aria-label={`fields of ${item.name}`}>
            {shown.map(([field, slot]) => (
                <ItemField key={slot.key} slot={slot} field={field} />
            ))}
            {hidden > 0 && (
                <button
                    type="button"
                    className="rv-fold-toggle rv-item-more"
                    aria-expanded={false}
                    title="Show this item’s fields not reported"
                    onClick={() => setOpen(true)}
                >
                    {`+ ${counted(hidden, 'more field')}`}
                </button>
            )}
        </div>
    );
}

/** A reference slot's links in the details: the same chips as the card's, and a button to open each linked entity. */
function SelectedLinks({ slot }: { slot: SlotNode }) {
    const index = useShown((i) => i);
    const focusEntity = useView((s) => s.focusEntity);
    return (
        <div className="rv-selected-links">
            <SlotChips slot={slot} chips={linkChips(index, slot)} />
            {slot.references.map((id) => (
                <OpenButton key={id} name={index.entity(id)?.name ?? id} title={id} onOpen={() => focusEntity(id)} />
            ))}
        </div>
    );
}

function SelectedSlot({ slot, layout }: { slot: SlotNode; layout: CardLayout }) {
    const label = useSession((s) => labelOf(s.index, slot));
    const panel = useView((s) => (s.panel?.slot === slot.key ? s.panel : null));
    const placement = layout.places.get(slot.key);
    const item = placement?.item;
    const editing = panel?.kind === 'edit' || panel?.kind === 'not_reported';
    const field = item ? [...item.fields].find(([, s]) => s.key === slot.key)?.[0] : undefined;
    const check = item?.distribution ? checkDistribution(item.fields) : undefined;
    const section = item ? `${placement.section} · ${item.name}` : placement?.section;
    return (
        <Box component="section" aria-label="Selected field" className="rv-selected">
            <Typography variant="overline" component="div" color="primary" className="rv-overline">
                {`Selected · ${section} · ${field === undefined ? label : inWords(field)}`}
            </Typography>
            <div className="rv-selected-body">
                <SlotHead slot={slot} label={label} />
                {!editing &&
                    (slot.kind === 'reference' ? (
                        <SelectedLinks slot={slot} />
                    ) : (
                        <div className="rv-slot-value">
                            <ValueView slot={slot} />
                        </div>
                    ))}
                {item && <ItemFields key={item.at} item={item} selected={slot.key} />}
                {check && (
                    <div className="rv-check" data-matches={check.matches}>
                        {check.text}
                    </div>
                )}
                <EvidenceStep />
                <SlotBody slot={slot} label={label} panel={panel} />
            </div>
        </Box>
    );
}

/** The analyses that analysed one n of the entity, each a link to its count there. */
function AnalysedList({ entity, n }: { entity: EntityNode; n: string }) {
    const counts = useSession((s) => analysedByN(s.index, entity.id).find((group) => group.n === n)?.counts ?? []);
    const focusSlot = useView((s) => s.focusSlot);
    return (
        <Box component="section" aria-label="Selected field" className="rv-selected">
            <Typography variant="overline" component="div" color="primary" className="rv-overline">
                {`Selected · n analysed · ${n}`}
            </Typography>
            <ul className="rv-selected-body rv-analyses" aria-label={`analyses with n ${n}`}>
                {counts.map(({ analysis, slot }) => (
                    <li key={slot.key}>
                        <OpenButton
                            name={analysis.name}
                            title="The analysed n is set on the analysis; open it there to change it"
                            onOpen={() => focusSlot(slot.key)}
                        />
                    </li>
                ))}
            </ul>
        </Box>
    );
}

/** The selection's details under the fields; an analysis's comparison draws its own for its chips. */
function Selected({ entity, layout }: { entity: EntityNode; layout: CardLayout }) {
    const key = useView((s) => (s.focus.entity === entity.id ? s.focus.slot : undefined));
    const analysed = useView((s) => (s.analysedOpen?.entity === entity.id ? s.analysedOpen.n : null));
    const slot = useShown((index) => (key === undefined ? undefined : index.slot(key)));
    if (analysed !== null && !slot) return <AnalysedList entity={entity} n={analysed} />;
    if (!slot || slot.entity !== entity.id || layout.places.get(slot.key)?.where === 'comparison') return null;
    return <SelectedSlot slot={slot} layout={layout} />;
}

/**
 * The n the analyses using `entity` analysed of it, on one line, grouped by value; each value opens the list of its
 * analyses in the selection's details.
 */
const AnalysedN = memo(function AnalysedN({ entity }: { entity: EntityNode }) {
    const groups = useSession((s) => analysedByN(s.index, entity.id));
    const openAnalysed = useView((s) => s.openAnalysed);
    const open = useView((s) => (s.analysedOpen?.entity === entity.id ? s.analysedOpen.n : null));
    if (groups.length === 0) return null;
    return (
        <div role="group" aria-label="analysed n" className="rv-analysed">
            <span>n analysed:</span>
            {groups.map(({ n, counts }, i) => (
                <span key={n}>
                    {i > 0 && '· '}
                    <button
                        type="button"
                        className="rv-open"
                        aria-expanded={open === n}
                        title="List the analyses with this n"
                        onClick={() => openAnalysed(entity.id, n)}
                    >
                        {`${n} in ${counts.length} ${counts.length === 1 ? 'analysis' : plural('analysis')}`}
                    </button>
                </span>
            ))}
        </div>
    );
});

/** The card's title: its name slot, a click on it focusing that slot, and the slot's marks. */
export function CardTitle({ entity }: { entity: EntityNode }) {
    const slot = useShown((index) => cardLayoutOf(index, entity).title);
    if (!slot)
        return (
            <Typography variant="h6" component="h2" title={entity.localId}>
                {entity.name}
            </Typography>
        );
    return <TitleValue entity={entity} slot={slot} />;
}

function TitleValue({ entity, slot }: { entity: EntityNode; slot: SlotNode }) {
    const focused = useFocused(slot);
    const handlers = useSlotHandlers(slot);
    return (
        <Box
            sx={titleStyles}
            className="rv-title"
            data-slot-key={slot.key}
            aria-current={focused ? 'true' : undefined}
            {...handlers}
        >
            <Typography variant="h6" component="h2" title={entity.localId}>
                <button type="button" className="rv-title-text" title="The name: click to check or edit it">
                    {entity.name}
                </button>
            </Typography>
            <SlotMarks slot={slot} />
        </Box>
    );
}

const titleStyles = (theme: Theme) => ({
    display: 'flex',
    alignItems: 'baseline',
    gap: 0.5,
    ...statusColors(theme.palette),
    '& .rv-title-text': {
        font: 'inherit',
        color: 'inherit',
        background: 'none',
        border: 0,
        p: 0,
        cursor: 'pointer',
        textAlign: 'start',
    },
    '&[aria-current="true"] .rv-title-text': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 1,
        borderRadius: 0.5,
    },
    '& .rv-marks': { display: 'inline-flex', gap: '1px' },
    '& .rv-marks svg': { width: 7, height: 7 },
});

const cardFieldStyles = (theme: Theme) => {
    const lines = underlines(theme.palette);
    const chip = chipStyle(theme);
    return {
        px: 2,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        ...statusColors(theme.palette),
        ...slotHeadStyles,
        '& .rv-overline': { lineHeight: 1.6, letterSpacing: '0.08em' },
        '& .rv-about': { typography: 'body2', lineHeight: 1.7, m: 0, overflowWrap: 'anywhere' },
        '& .rv-value': { display: 'inline-flex', alignItems: 'baseline', gap: 0.25, cursor: 'pointer' },
        '& .rv-value-text': {
            font: 'inherit',
            color: 'inherit',
            background: 'none',
            border: 0,
            p: 0,
            cursor: 'pointer',
            textAlign: 'start',
            borderBottom: `1px dotted ${lines.judged}`,
            maxWidth: '24em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
        },
        '& .rv-value-text[data-unchecked]': { borderBottom: `1px dashed ${lines.unchecked}` },
        '& [aria-current="true"] > .rv-value-text, & .rv-row[aria-current="true"] > .rv-value-text': {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 1,
            borderRadius: 0.5,
        },
        '& .rv-marks': { display: 'inline-flex', gap: '1px', alignItems: 'center', ml: '1px' },
        '& .rv-marks svg': { width: 7, height: 7 },
        '& .rv-warn': { color: theme.palette.sign.missing.text, fontWeight: 700 },
        '& .rv-analysed': { typography: 'body2', display: 'flex', flexWrap: 'wrap', gap: 0.5 },
        '& .rv-rows, & .rv-item-fields': {
            display: 'grid',
            gridTemplateColumns: '9.5rem minmax(0, 1fr) auto',
            columnGap: 1,
            rowGap: 0,
            lineHeight: 1.5,
            alignItems: 'center',
        },
        '& .rv-row': { display: 'contents', cursor: 'pointer' },
        '& .rv-row-label': {
            typography: 'body2',
            lineHeight: 'inherit',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        '& .rv-row-value': { typography: 'body2', lineHeight: 'inherit', maxWidth: '100%', display: 'block' },
        '& .rv-row-line, & .rv-item-fields > .rv-value': {
            typography: 'body2',
            lineHeight: 'inherit',
            gridColumn: 'span 2',
            minWidth: 0,
        },
        '& .rv-row-line': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        '& .rv-item-more': { gridColumn: '1 / -1' },
        '& .rv-links': { display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.75, alignItems: 'center' },
        '& .rv-link-group, & .rv-chips, & .rv-selected-links': {
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: 0.5,
            alignItems: 'center',
        },
        '& .rv-link-label': { typography: 'body2', color: 'text.secondary' },
        '& .rv-link-chip, & .rv-item-chip': chip,
        ...openStyles(theme),
        '& .rv-chip-name': {
            font: 'inherit',
            color: 'inherit',
            background: 'none',
            border: 0,
            p: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
        },
        '& .rv-chip-remove': { fontSize: 14, color: 'text.secondary', cursor: 'pointer' },
        '& .rv-none': { borderStyle: 'dashed', borderColor: lines.judged, color: 'text.secondary' },
        '& .rv-link-chip[aria-current="true"], & .rv-chips[aria-current="true"] .rv-none': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 1,
        },
        '& .rv-fold .rv-rows': { mt: 0.5 },
        '& .rv-selected': { borderTop: 1, borderColor: 'divider', pt: 1 },
        '& .rv-selected-body': {
            bgcolor: 'background.paper',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            m: 0,
            listStyle: 'none',
        },
        '& .rv-evidence, & .rv-check': { typography: 'caption', color: 'text.secondary' },
        '& .rv-check[data-matches="false"]': { color: theme.palette.sign.missing.text },
    };
};

/** The card's fields laid out as its class's template says: its sentences and rows, its links, the fold, the selection. */
export const CardFields = memo(function CardFields({ entity }: { entity: EntityNode }) {
    const layout = useShown((index) => cardLayoutOf(index, entity));
    return (
        <Box sx={cardFieldStyles}>
            <AnalysedN entity={entity} />
            {(layout.about.length > 0 || layout.rows.length > 0) && (
                <section aria-label="About">
                    <Typography variant="overline" component="h3" color="text.secondary" className="rv-overline">
                        About
                    </Typography>
                    {layout.about.map((line, i) => (
                        <p key={i} className="rv-about">
                            <Pieces pieces={line} />
                        </p>
                    ))}
                    {layout.rows.length > 0 && (
                        <div className="rv-rows">
                            {layout.rows.map((row) => (
                                <LineRow key={row.label} row={row} />
                            ))}
                        </div>
                    )}
                </section>
            )}
            {layout.links.length > 0 && (
                <section aria-label="Links">
                    <Typography variant="overline" component="h3" color="text.secondary" className="rv-overline">
                        Links
                    </Typography>
                    <div className="rv-links">
                        {layout.links.map((group) => (
                            <LinkGroupView key={group.label} group={group} />
                        ))}
                    </div>
                </section>
            )}
            {layout.folded.length > 0 && <Fold entity={entity} folded={layout.folded} />}
            <Selected entity={entity} layout={layout} />
        </Box>
    );
});
