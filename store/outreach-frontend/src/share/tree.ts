/** Picking the group maps out of a results folder the author chose, before uploading.
 *
 * A results folder holds far more than the maps we want: FSL's .gfeat has 4D residuals and
 * masks, SPM's has betas and ResMS. We pre-select the t/z, effect and variance maps, leave
 * out thresholded copies, and keep each file's path so the server can tell which effect
 * map sits beside which statistic map. When the folder holds more maps than the paper
 * takes, whole sets are ticked first: a t/z map, then its effect and variance maps. Names
 * here mirror the server's (store/backend/neurostore/outreach/map_sets.py), but only
 * choose what to suggest; the server reads each file's own header too. */

import { inFolder } from './review';

export type GuessedKind = 't' | 'z' | 'f' | 'effect' | 'variance' | 'other';

export interface Candidate {
    file: File;
    path: string;
    kind: GuessedKind;
    /** Pre-selected for upload. */
    selected: boolean;
    /** Why it is not pre-selected, when it is not. */
    note: string | null;
}

const RULES: [GuessedKind, RegExp][] = [
    ['variance', /varcope|effect_variance|stat-variance|variance|(^|[_-])var[_-]?\d/],
    ['effect', /(^|[_-])cope\d|(^|[_-])con_\d|effect_size|stat-effect|(^|[_-])effect([_.-]|$)|(^|[_-])beta([_-]?\d|[_.-]|$)/],
    ['z', /zstat|z_score|zscore|stat-z([_.-]|$)|spmz|(^|[_-])z([_.-]|$)/],
    ['t', /tstat|spmt|stat-t([_.-]|$)|t_stat|(^|[_-])t([_.-]|$)/],
    ['f', /fstat|spmf|stat-f([_.-]|$)/],
];
/** Files in a results folder that are never a group map we ask for. */
const SKIP = /thresh|random_effects|weights|filtered_func|res4d|mask|mean_func|example_func|bg_image|sigmasquareds|resms|(^|[_-])rpv|(^|[_-])pe\d|tdof|(^|[_-])dof|smoothness|rendered|mni152|template|(^|[_-])t1w?([_.-]|$)|zfstat/;
const THRESHOLDED = /thresh/;
const NIFTI = /\.nii(\.gz)?$/i;
/** What tells the maps of one set apart, as the server's set_key strips it. */
const KIND_TOKENS =
    /varcope|cope|zstat|tstat|fstat|spmt|spmf|spmz|con|effect_size|effect_variance|z_score|zscore|t_score|stat-(t|z|f|effect|variance)|variance|effect|beta|statmap|(?<![a-z0-9])[tzf](?![a-z0-9])/g;
const STATISTIC: GuessedKind[] = ['t', 'z'];

export function guessKind(name: string): GuessedKind {
    const stem = name.toLowerCase().replace(NIFTI, '');
    return RULES.find(([, pattern]) => pattern.test(stem))?.[0] ?? 'other';
}

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');
const numberOf = (name: string) => name.match(/(\d+)(?!.*\d)/)?.[1]?.replace(/^0+(?=\d)/, '') ?? '';

/** (folder, stem) that a t/z map shares with its effect and variance maps: cope3 and
 * zstat3 in one folder share "3"; faces_Beta and faces_T share "faces". */
export function setKey(path: string): string {
    const lowered = path.toLowerCase();
    const stem = (lowered.split('/').pop() ?? '')
        .replace(NIFTI, '')
        .replace(KIND_TOKENS, ' ')
        .replace(/\d+/g, (digits) => String(Number(digits)))
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return `${folderOf(lowered)}|${stem}`;
}

function note(name: string, kind: GuessedKind): string | null {
    if (THRESHOLDED.test(name)) return 'thresholded copy';
    if (SKIP.test(name)) return 'not a group map';
    if (kind === 'f') return 'select it if an analysis is an F test';
    if (kind === 'other') return 'not recognised; select it if it is a group map';
    return null;
}

/** The map of ``kind`` in ``pool`` that goes with a t/z map: same folder and stem, a
 * contrast map before an SPM beta, which is a regressor. */
function partnerIn(pool: Candidate[], statistic: Candidate, kind: GuessedKind): Candidate | undefined {
    const isBeta = (map: Candidate) => Number(/beta/.test(map.file.name.toLowerCase()));
    return pool
        .filter((map) => map.kind === kind && setKey(map.path) === setKey(statistic.path))
        .sort((a, b) => isBeta(a) - isBeta(b))[0];
}

/** The maps in a chosen folder, the likely ones selected, up to ``limit`` of them. */
export function pickMaps(files: { file: File; path: string }[], limit: number): Candidate[] {
    const maps = files
        .filter(({ file }) => NIFTI.test(file.name))
        .map(({ file, path }) => {
            const name = file.name.toLowerCase();
            const kind = guessKind(name);
            const why = note(name, kind);
            return { file, path, kind, selected: why === null, note: why };
        })
        .sort((a, b) => a.path.localeCompare(b.path));
    // FSL writes a t and a z map of each contrast side by side: ask for the z.
    for (const map of maps) {
        if (map.kind !== 't' || !map.selected) continue;
        const twin = maps.find(
            (other) =>
                other.kind === 'z' &&
                other.selected &&
                folderOf(other.path) === folderOf(map.path) &&
                numberOf(other.file.name) === numberOf(map.file.name)
        );
        if (twin) Object.assign(map, { selected: false, note: 'its z map is selected' });
    }
    // Whole sets first, in folder order: each t/z map with one effect and one variance map
    // (a contrast map before an SPM beta, which is a regressor), then the rest.
    const wanted = maps.filter((map) => map.selected);
    const order = [
        ...wanted
            .filter((map) => STATISTIC.includes(map.kind))
            .flatMap((statistic) => [
                statistic,
                partnerIn(wanted, statistic, 'effect'),
                partnerIn(wanted, statistic, 'variance'),
            ]),
        ...wanted,
    ].filter((map): map is Candidate => map !== undefined);
    const chosen = new Set<Candidate>();
    for (const map of order) if (chosen.size < limit) chosen.add(map);
    for (const map of wanted) if (!chosen.has(map)) Object.assign(map, { selected: false, note: 'over the limit' });
    return maps;
}

/** The maps whose path holds every word of ``query``, in any case. */
export function filterCandidates<T extends { path: string }>(items: T[], query: string): T[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length === 0
        ? items
        : items.filter((item) => words.every((word) => item.path.toLowerCase().includes(word)));
}

/** Maps grouped by the folder they sit in (named relative to ``base``, the folder the
 * author chose), in the order they first appear. */
export function groupByFolder(items: Candidate[], base: string): { folder: string; maps: Candidate[] }[] {
    const groups = new Map<string, Candidate[]>();
    for (const item of items) {
        const full = folderOf(item.path);
        const folder = full === base ? '' : inFolder(full, base);
        groups.set(folder, [...(groups.get(folder) ?? []), item]);
    }
    return [...groups].map(([folder, maps]) => ({ folder, maps }));
}

/** Files that are never worth offering in place of a ticked map. */
const NOT_OFFERED = ['thresholded copy', 'not a group map', 'its z map is selected'];
const alike = (a: GuessedKind, b: GuessedKind) => a === b || (STATISTIC.includes(a) && STATISTIC.includes(b));
const sharedSegments = (a: string, b: string) => {
    const [left, right] = [a.split('/'), b.split('/')];
    let count = 0;
    while (count < left.length && left[count] === right[count]) count++;
    return count;
};

/** Whether ``other`` could be offered in place of the ticked ``map``. */
const offeredInstead = (map: Candidate, selected: Set<string>) => (other: Candidate) =>
    !selected.has(other.path) &&
    alike(other.kind, map.kind) &&
    !(other.note !== null && NOT_OFFERED.includes(other.note));

/** Whether there is any map to offer in place of ``map``: the answer similarMaps would give,
 * without sorting a long list to learn it. */
export const hasSimilarMap = (map: Candidate, all: Candidate[], selected: Set<string>): boolean =>
    all.some(offeredInstead(map, selected));

/** Maps the author might have meant instead of a ticked one: not ticked, the same kind of
 * map (a t and a z map count as alike), the nearest in the folder tree first. */
export function similarMaps(map: Candidate, all: Candidate[], selected: Set<string>): Candidate[] {
    return all
        .filter(offeredInstead(map, selected))
        .sort(
            (a, b) =>
                sharedSegments(b.path, map.path) - sharedSegments(a.path, map.path) || a.path.localeCompare(b.path)
        );
}

/** What changes when ``to`` is ticked in place of the ticked map ``from``. A t/z map
 * brings the effect and variance maps that go with it, and only the kinds the old set had,
 * so a swap never adds a map the author had left out. */
export function swapMaps(
    from: Candidate,
    to: Candidate,
    all: Candidate[],
    selected: Set<string>
): { removed: Candidate[]; added: Candidate[] } {
    const removed = [from];
    const added = [to];
    if (STATISTIC.includes(from.kind)) {
        const ticked = all.filter((map) => selected.has(map.path));
        const free = all.filter(
            (map) => !selected.has(map.path) && !(map.note !== null && NOT_OFFERED.includes(map.note))
        );
        for (const kind of ['effect', 'variance'] as const) {
            const old = partnerIn(ticked, from, kind);
            if (!old) continue;
            removed.push(old);
            const next = partnerIn(free, to, kind);
            if (next) added.push(next);
        }
    }
    return { removed, added };
}

/** A folder's files with their paths inside it, from an <input webkitdirectory>. */
export const withPaths = (files: FileList | File[]) =>
    Array.from(files).map((file) => ({ file, path: file.webkitRelativePath || file.name }));

/** What was dropped on the page, taken synchronously: the list empties after an await. */
export const droppedEntries = (items: DataTransferItemList) =>
    Array.from(items)
        .map((item) => item.webkitGetAsEntry?.() ?? null)
        .filter((entry): entry is FileSystemEntry => entry !== null);

/** Every file under a dropped file or folder, with its path as <input webkitdirectory>
 * would give it: the dropped folder's name first, no leading slash. */
export async function filesUnder(entry: FileSystemEntry): Promise<{ file: File; path: string }[]> {
    if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        return [{ file, path: entry.fullPath.replace(/^\//, '') }];
    }
    if (!entry.isDirectory) return [];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries hands out at most 100 entries at a time; read until it runs dry.
    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        children.push(...batch);
    }
    return (await Promise.all(children.map(filesUnder))).flat();
}
