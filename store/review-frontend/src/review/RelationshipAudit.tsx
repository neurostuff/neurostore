import { Box, List, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, useMemo } from 'react';
import { acceptLinks, linkProgress, pendingLinks, unjudgedLinks, unlink } from '../inspector/actions';
import { AcceptedStatus } from '../inspector/Inspector';
import { NoteMark } from '../inspector/NoteMark';
import { LinkPanel, NotePanel, RejectPanel } from '../inspector/panels';
import { slotStyles } from '../inspector/slotStyles';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { useScrollIntoViewWhen } from '../inspector/useScrollIntoViewWhen';
import { auditCards, takesAnother, type AuditCard, type AuditGroup, type AuditLink } from '../model/guided';
import { classWords, counted, humanize, labelOf, plural, withArticle } from '../model/labels';
import type { EntityNode, SlotNode } from '../model/record';
import { slotTarget, targetKey } from '../model/targetKey';
import { useIsEditable, useReviewStores, useSession, useShownDocuments, useView } from '../store/context';
import type { Panel } from '../store/viewStore';
import { FieldActions } from './actionButtons';
import { useEditorName } from './editor';
import { selectNotes } from './outline';
import { quickButtons } from './quickButtons';
import { StepCard, StepCardList } from './StepCardList';

const rowStyles = (theme: Theme) => ({
    ...slotStyles(theme),
    '& .rv-slot-head': { typography: 'caption', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5 },
    '& .rv-link-name': { typography: 'body2', overflowWrap: 'anywhere', flex: '1 1 12em' },
});

/** The panel on the link `key`, while one is open on it. */
const panelOn = (panel: Panel | null, key: string) =>
    panel?.target.kind === 'relationship' && targetKey(panel.target) === key ? panel : null;

/** Opens the picker of the group whose first slot is `slot`: a link panel on it. */
function useOpenPicker(slot: { entity: string; path: string; key: string }) {
    const openPanel = useView((s) => s.openPanel);
    return () => openPanel({ kind: 'link', target: slotTarget(slot.entity, slot.path), slot: slot.key });
}

function RemoveLink({ slot, target, label }: { slot: SlotNode; target: string; label: string }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    return (
        <button
            type="button"
            className="rv-quick"
            data-color="error"
            disabled={!editable}
            title={`Remove the link ${label}`}
            onClick={() => void unlink(stores, slot, target)}
        >
            Remove link
        </button>
    );
}

/** Opens the picker that changes a single link to another entity of its class. */
function ChangeLink({ slot, kind, label }: { slot: SlotNode; kind: string; label: string }) {
    const editable = useIsEditable();
    const open = useOpenPicker(slot);
    return (
        <button
            type="button"
            className="rv-quick"
            disabled={!editable}
            title={`Pick another ${kind} in place of ${label} (l)`}
            onClick={open}
        >
            {`Change ${kind}`}
        </button>
    );
}

const LinkRow = memo(function LinkRow({
    analysis,
    link: { slot, target, key },
    via,
    single,
    focused,
    unlinking,
    panel,
}: {
    analysis: string;
    link: AuditLink;
    /** The slot's label, where the group links through several. */
    via?: string;
    /** The class's words, where the slot holds this one link only. */
    single?: string;
    focused: boolean;
    unlinking: boolean;
    panel: Panel | null;
}) {
    const focusLink = useView((s) => s.focusLink);
    const name = useSession((s) => s.index.entity(target)?.name ?? target);
    const state = useSession((s) => s.provenance[key]?.state);
    const editor = useEditorName(key);
    const notes = useSession((s) => selectNotes(s).get(key)?.join('\n'));
    const ref = useScrollIntoViewWhen<HTMLLIElement>(focused);
    const label = `${analysis} → ${name}`;
    return (
        <li
            ref={ref}
            className="rv-slot"
            data-link-key={key}
            aria-current={focused ? 'true' : undefined}
            aria-busy={unlinking || undefined}
            onClick={() => {
                if (!panel) focusLink(slot.key, target);
            }}
        >
            <div className="rv-slot-head">
                <span className="rv-link-name">{name}</span>
                {via && <span className="rv-slot-label">{via}</span>}
                <StatusLabel id={reviewStatus(state)} by={editor} />
                {notes && <NoteMark notes={notes} />}
                {unlinking && <span>unlinking…</span>}
            </div>
            {focused && !panel && !unlinking && (
                <FieldActions label={label}>
                    {single && <ChangeLink slot={slot} kind={single} label={name} />}
                    <RemoveLink slot={slot} target={target} label={label} />
                </FieldActions>
            )}
            {panel?.kind === 'reject' && <RejectPanel target={panel.target} label={label} />}
            {panel?.kind === 'note' && <NotePanel target={panel.target} label={label} />}
        </li>
    );
});

/**
 * The way to add a link to the group: its picker while open, or at once while the group has none; else "+ link
 * another" where the slot takes another and an entity is left to link; else nothing. A single link the picker
 * changes instead.
 */
function AddLink({
    analysis,
    group,
    adding,
    linking,
}: {
    analysis: EntityNode;
    group: AuditGroup;
    adding: boolean;
    linking: string[];
}) {
    const editable = useIsEditable();
    const [first] = group.slots;
    const open = useOpenPicker(first);
    const slot = useMemo(
        () => ({ ...first, references: group.slots.flatMap((s) => s.references) }),
        [first, group.slots]
    );
    const kind = classWords(group.className);
    const linked = group.links.length > 0;
    const replacing = linked && !group.list ? group.links[0].target : undefined;
    const showsPicker = adding || !linked;
    const offersAnother = linked && takesAnother(group) && group.unlinked.some((e) => !linking.includes(e.id));
    if (showsPicker) {
        const label =
            replacing !== undefined
                ? `change the ${kind} of ${analysis.name} to`
                : `link ${linked ? `another ${kind}` : withArticle(kind)} to ${analysis.name}`;
        return (
            <Box sx={{ px: 2 }}>
                <LinkPanel slot={slot} label={label} autoFocus={adding} disabled={!editable} replacing={replacing} />
            </Box>
        );
    }
    if (!offersAnother) return null;
    return (
        <Box sx={[{ px: 2, pt: 0.5 }, quickButtons]}>
            <button
                type="button"
                className="rv-quick"
                disabled={!editable}
                title={`Pick another ${kind} for ${analysis.name} to use (l on a link)`}
                onClick={open}
            >
                {`+ link another ${kind}`}
            </button>
        </Box>
    );
}

/** The analysis's links to one class, headed with how many there are, then the way to add one. */
const LinkGroup = memo(function LinkGroup({ analysis, group }: { analysis: EntityNode; group: AuditGroup }) {
    const { className, slots, links } = group;
    const kind = classWords(className);
    const heading = `${humanize(plural(kind))} (${links.length} linked)`;
    const focusKey = useView((s) => s.focus.key);
    const panel = useView((s) => s.panel);
    const index = useSession((s) => s.index);
    const pending = useSession((s) => s.pending);
    const waiting = useMemo(
        () => slots.map((slot) => ({ slot, ...pendingLinks({ pending }, slot.key) })),
        [slots, pending]
    );
    const linking = waiting.flatMap(({ slot, linking: ids }) =>
        ids.filter((id) => !slot.references.includes(id)).map((id) => ({ slot, id }))
    );
    const unlinking = (link: AuditLink) =>
        waiting.some(({ slot, unlinking: ids }) => slot.key === link.slot.key && ids.has(link.target));
    const adding = panel?.kind === 'link' && slots.some((slot) => slot.key === panel.slot);
    return (
        <Box role="group" aria-label={heading} sx={{ pb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ px: 2, pt: 1 }}>
                {heading}
            </Typography>
            <List dense disablePadding sx={rowStyles}>
                {links.map((link) => (
                    <LinkRow
                        key={link.key}
                        analysis={analysis.name}
                        link={link}
                        via={slots.length > 1 ? labelOf(index, link.slot) : undefined}
                        single={group.list ? undefined : kind}
                        focused={link.key === focusKey}
                        unlinking={unlinking(link)}
                        panel={panelOn(panel, link.key)}
                    />
                ))}
                {linking.map(({ slot, id }) => (
                    <li key={`${slot.key} ${id}`} className="rv-slot" aria-busy>
                        <div className="rv-slot-head">
                            <span className="rv-linking">{`${index.entity(id)?.name ?? id} · linking…`}</span>
                        </div>
                    </li>
                ))}
            </List>
            {links.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                    {`No ${kind} linked`}
                </Typography>
            )}
            <AddLink analysis={analysis} group={group} adding={adding} linking={linking.map(({ id }) => id)} />
        </Box>
    );
});

/** Accepts the card's links no one has judged yet, as one batch, opening the card. */
function AcceptLinks({ card }: { card: AuditCard }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const unjudged = useSession((s) => unjudgedLinks(s, card).length);
    const accept = () => {
        const view = stores.view.getState();
        if (view.focus.entity !== card.analysis.id) view.focusEntity(card.analysis.id);
        acceptLinks(stores, card);
    };
    return (
        <button
            type="button"
            className="rv-quick"
            aria-keyshortcuts="Shift+A"
            disabled={!editable || unjudged === 0}
            title={
                unjudged
                    ? `Accept the ${counted(unjudged, 'link')} of this analysis no one has judged yet (Shift+A)`
                    : 'Every link of this analysis is judged'
            }
            onClick={accept}
        >
            Accept all links
        </button>
    );
}

/** An analysis's card: its head with its count, and its links by class while it is open. */
const AnalysisCard = memo(function AnalysisCard({ card, open }: { card: AuditCard; open: boolean }) {
    const { analysis, groups } = card;
    const count = useSession((s) => {
        const { done, total } = linkProgress(s, card);
        return `${done} of ${total}`;
    });
    return (
        <StepCard
            id={analysis.id}
            name={analysis.name}
            secondary={`${count} links judged`}
            actions={<AcceptLinks card={card} />}
            open={open}
            region={`Links of ${analysis.name}`}
        >
            <Box sx={[{ px: 2, pt: 0.5 }, quickButtons]}>
                <AcceptedStatus entity={analysis.id} kind="analysis" />
            </Box>
            {groups.map((group) => (
                <LinkGroup key={group.className} analysis={analysis} group={group} />
            ))}
        </StepCard>
    );
});

/** Step 5: a card per analysis listing its links by class; the focused one open, the others collapsed to their heads. */
export function RelationshipAudit() {
    const cards = useShownDocuments(auditCards);
    const focused = useView((s) => s.focus.entity);
    return (
        <StepCardList
            step="relationships"
            label="relationships"
            heading="relationship audit"
            empty={cards.length === 0 ? 'No links to audit.' : undefined}
        >
            {cards.map((card) => (
                <AnalysisCard key={card.analysis.id} card={card} open={card.analysis.id === focused} />
            ))}
        </StepCardList>
    );
}
