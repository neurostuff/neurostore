import { Box, Typography } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { memo, useState, type ReactNode } from 'react';
import { acceptLinksOf, pendingStructure, unlink } from '../inspector/actions';
import { OpenButton, openStyles } from '../inspector/OpenButton';
import { LinkPanel, NotePanel, RejectPanel } from '../inspector/panels';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusMark } from '../inspector/StatusLabel';
import { classWords } from '../model/labels';
import { linkedFrom, sentenceOf, type LinkGroup as Group, type SaidLink } from '../model/linkedFrom';
import type { EntityNode } from '../model/record';
import { useIsEditable, useReviewStores, useSession, useShown, useView } from '../store/context';
import { FieldActions } from './actionButtons';
import { useEditorName } from './editor';
import { quickButtons } from './quickButtons';
import { panelOn } from './RelationshipAudit';

const sectionStyles = (theme: Theme) => ({
    px: 2,
    ...statusColors(theme.palette),
    ...openStyles(theme),
    ...quickButtons(theme),
    '& .rv-linked-list': { listStyle: 'none', m: 0, p: 0 },
    '& .rv-linked': {
        typography: 'body2',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 0.75,
        py: 0.25,
        px: 0.5,
        borderRadius: 0.5,
        cursor: 'pointer',
    },
    '& .rv-linked[aria-current="true"]': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
    '& .rv-linked-text': { flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' },
    '& .rv-linked .rv-open': {
        display: 'inline-block',
        maxWidth: '100%',
        whiteSpace: 'normal',
        textAlign: 'start',
        verticalAlign: 'baseline',
        px: 0.5,
        py: 0,
    },
    '& .rv-linked-group > .rv-linked-list': { pl: 2 },
    '& .rv-linked-below': { flexBasis: '100%', cursor: 'default' },
});

/** Unlinks the focused link from its row. */
function UnlinkButton({ link }: { link: SaidLink }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    return (
        <button
            type="button"
            className="rv-quick"
            data-color="error"
            disabled={!editable}
            title={`Unlink: ${sentenceOf(link)}`}
            onClick={() => void unlink(stores, link.slot, link.target.target_entity)}
        >
            Unlink
        </button>
    );
}

/** What shows under the focused row: its field actions and Unlink, or the panel open on it, or that it is unlinking. */
function FocusedLink({ link }: { link: SaidLink }) {
    const editable = useIsEditable();
    const sentence = sentenceOf(link);
    const panel = useView((s) => panelOn(s.panel, link.key));
    const picking = useView((s) => s.panel?.kind === 'link' && s.panel.slot === link.slot.key);
    const unlinking = useSession(
        (s) => pendingStructure(s).linksBySlot.get(link.slot.key)?.get(link.target.target_entity) === 'unlink'
    );
    if (unlinking)
        return (
            <Typography variant="caption" color="text.secondary">
                unlinking…
            </Typography>
        );
    return (
        <div className="rv-linked-below">
            {panel?.kind === 'reject' ? (
                <RejectPanel target={panel.target} label={sentence} />
            ) : panel?.kind === 'note' ? (
                <NotePanel target={panel.target} label={sentence} />
            ) : picking ? (
                <LinkPanel
                    slot={link.slot}
                    label={`link another ${classWords(link.entity.entityClass)} to ${link.entity.name}`}
                    autoFocus
                    disabled={!editable}
                />
            ) : (
                <FieldActions label={sentence}>
                    <UnlinkButton link={link} />
                </FieldActions>
            )}
        </div>
    );
}

/**
 * A row of one link into the card's entity, read out as its sentence, with its status mark; a click focuses the link,
 * so the text highlights both entities' evidence and the row shows its actions.
 */
const LinkRow = memo(function LinkRow({ link, children }: { link: SaidLink; children: ReactNode }) {
    const focusLinkInto = useView((s) => s.focusLinkInto);
    const focused = useView((s) => s.focus.key === link.key);
    const state = useSession((s) => s.provenance[link.key]?.state);
    const editor = useEditorName(link.key);
    return (
        <li
            className="rv-linked"
            aria-label={sentenceOf(link)}
            aria-current={focused ? 'true' : undefined}
            onClick={() => {
                if (!focused) focusLinkInto(link.slot.key, link.target.target_entity);
            }}
        >
            <span className="rv-linked-text">{children}</span>
            <StatusMark id={reviewStatus(state)} by={editor} explained />
            {focused && <FocusedLink link={link} />}
        </li>
    );
});

/** A chip opening the linker of `link`, named `name`. */
function LinkerChip({ link, name, label }: { link: SaidLink; name: string; label?: string }) {
    const focusEntity = useView((s) => s.focusEntity);
    return (
        <OpenButton
            name={name}
            label={label}
            arrow={false}
            title={`Open ${link.entity.name}`}
            onOpen={() => focusEntity(link.entity.id)}
        />
    );
}

/** Links alike: said once, opening to a row per linker, their unjudged ones accepted at once. */
function LinkGroup({ group, target }: { group: Group; target: string }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const [open, setOpen] = useState(false);
    const { links, lead, rest } = group;
    const left = useSession((s) => links.filter((link) => !s.provenance[link.key]).length);
    const all = left === 0 || left === links.length;
    return (
        <li className="rv-linked-group" aria-label={sentenceOf(group)}>
            <div className="rv-linked">
                <span className="rv-linked-text">
                    <button
                        type="button"
                        className="rv-fold-toggle"
                        aria-expanded={open}
                        title={open ? 'Hide each link' : 'List each link'}
                        onClick={() => setOpen(!open)}
                    >
                        {lead}
                    </button>
                    {rest}
                </span>
                <button
                    type="button"
                    className="rv-quick"
                    disabled={!editable || left === 0}
                    title={left ? `Accept the ${left} links no one has judged yet` : 'Every link is judged'}
                    onClick={() =>
                        acceptLinksOf(
                            stores,
                            target,
                            links.map((link) => link.target)
                        )
                    }
                >
                    {all ? `Accept all ${links.length}` : `Accept the ${left} left`}
                </button>
            </div>
            {open && (
                <ul className="rv-linked-list">
                    {links.map((link) => (
                        <LinkRow key={link.key} link={link}>
                            <LinkerChip
                                link={link}
                                name={link.parent?.name ?? link.entity.name}
                                label={
                                    link.parent
                                        ? `open ${link.entity.name} in ${link.parent.name}`
                                        : `open ${link.entity.name}`
                                }
                            />
                        </LinkRow>
                    ))}
                </ul>
            )}
        </li>
    );
}

/** The links pointing at `entity`, each said as a sentence with its review status, to accept or unlink. */
export function LinkedFrom({ entity }: { entity: EntityNode }) {
    const entries = useShown((index) => linkedFrom(index, entity));
    const kind = classWords(entity.entityClass);
    const heading = `Linked from: what points to this ${kind}`;
    return (
        <Box component="section" aria-label={heading} sx={sectionStyles}>
            <Typography variant="overline" component="h3">
                {heading}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                {`Other parts of the record that refer to this ${kind}. Accept a link if it is right, or unlink it.`}
            </Typography>
            {entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Nothing links to it.
                </Typography>
            ) : (
                <ul className="rv-linked-list" aria-label="linked from">
                    {entries.map((entry) =>
                        entry.kind === 'one' ? (
                            <LinkRow key={entry.link.key} link={entry.link}>
                                {`${entry.link.lead} `}
                                <LinkerChip link={entry.link} name={entry.link.entity.name} />
                                {entry.link.rest}
                            </LinkRow>
                        ) : (
                            <LinkGroup key={entry.links[0].key} group={entry} target={entity.id} />
                        )
                    )}
                </ul>
            )}
        </Box>
    );
}
