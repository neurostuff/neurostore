import type { ShareUpload, ShareView } from './types';

/** A t/z map with the effect and variance maps that go with it: the unit the author moves.
 * An effect map with no t/z map beside it is a group of its own. */
export interface Group {
    lead: ShareUpload;
    members: ShareUpload[];
}

export interface Board {
    /** Groups with no analysis yet. */
    pool: Group[];
    /** Every analysis, in the paper's order, with the groups on it. */
    lanes: Map<string, Group[]>;
}

const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((key) => b.includes(key));

/** Where each usable file sits: on the analyses the server saved for it, else in the pool.
 * The page has no confidence rule of its own; a saved guess is the server's call, and
 * warnings and fit chips never move a map. Files that could not be read are left off, as
 * they cannot go on an analysis (the page lists them with their error instead). */
export function board(view: ShareView): Board {
    const usable = view.uploads.filter((upload) => upload.check_status === 'ok');
    const byId = new Map(usable.map((upload) => [upload.id, upload]));
    // A set takes its analyses from its t/z map unless the author put a member somewhere
    // else, which makes that member its own group.
    const attached = (upload: ShareUpload) => {
        const partner = upload.partner_id ? byId.get(upload.partner_id) : undefined;
        if (!partner || partner.id === upload.id || partner.partner_id) return undefined;
        const apart = upload.assigned_by === 'author' && !sameKeys(upload.analysis_keys, partner.analysis_keys);
        return apart ? undefined : partner;
    };
    const groups = usable.filter((upload) => !attached(upload)).map((lead) => ({ lead, members: [] as ShareUpload[] }));
    const byLead = new Map(groups.map((group) => [group.lead.id, group]));
    for (const upload of usable) {
        const lead = attached(upload);
        if (lead) byLead.get(lead.id)?.members.push(upload);
    }

    const lanes = new Map<string, Group[]>(view.analyses.map((analysis) => [analysis.key, []]));
    const pool: Group[] = [];
    for (const group of groups) {
        const keys = group.lead.analysis_keys.filter((key) => lanes.has(key));
        if (keys.length === 0) pool.push(group);
        for (const key of keys) lanes.get(key)!.push(group);
    }
    return { pool, lanes };
}

/** The analyses to send for a group's t/z map after the author moves it. ``from`` is the
 * analysis they moved it off (null from the pool), ``to`` where it goes (null for the
 * pool, which also covers "remove from analysis"). A map on several analyses keeps the
 * others. An empty list is sent as is: it records the author's choice, so the server
 * does not guess again. */
export function moveKeys(keys: string[], to: string | null, from: string | null): string[] {
    const rest = from ? keys.filter((key) => key !== from) : keys;
    return to === null || rest.includes(to) ? rest : [...rest, to];
}

/** The calls that move a group: its t/z map, plus any member the author placed
 * themselves, since the server only carries the others along with their t/z map. */
export function moves(group: Group, to: string | null, from: string | null): { id: string; keys: string[] }[] {
    const keys = moveKeys(group.lead.analysis_keys, to, from);
    const placed = group.members.filter((member) => member.assigned_by === 'author');
    return [group.lead, ...placed].map((upload) => ({ id: upload.id, keys }));
}

/** The analyses whose name holds ``query``, for the move menu's search box. */
export function filterAnalyses<T extends { name: string }>(analyses: T[], query: string): T[] {
    const wanted = query.trim().toLowerCase();
    return wanted ? analyses.filter((analysis) => analysis.name.toLowerCase().includes(wanted)) : analyses;
}

/** How many maps the author has dealt with: a map counts once it is on an analysis or has
 * a description. An effect or variance map counts with its t/z map. Files that could not
 * be read are not counted, as they cannot be dealt with here. */
export function progress(view: ShareView): { done: number; total: number } {
    const { pool, lanes } = board(view);
    const size = (group: Group) => 1 + group.members.length;
    const placed = new Map<string, Group>();
    for (const groups of lanes.values()) for (const group of groups) placed.set(group.lead.id, group);
    const described = pool.filter((group) => (group.lead.label ?? '').trim() !== '');
    const sum = (groups: Group[]) => groups.reduce((total, group) => total + size(group), 0);
    return { done: sum([...placed.values()]) + sum(described), total: sum([...placed.values()]) + sum(pool) };
}

/** What the submit step sums up: the maps that came up, how many are still on no analysis
 * (a map the author described counts as dealt with, as on the board), and how many of the
 * paper's analyses have a map and how many are still empty. */
export function summary(view: ShareView): { uploaded: number; unassigned: number; filled: number; empty: number } {
    const { done, total } = progress(view);
    const filled = view.analyses.filter((analysis) =>
        view.uploads.some((upload) => upload.check_status === 'ok' && upload.analysis_keys.includes(analysis.key))
    ).length;
    return { uploaded: total, unassigned: total - done, filled, empty: view.analyses.length - filled };
}
