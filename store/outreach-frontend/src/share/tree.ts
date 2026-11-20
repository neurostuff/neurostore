/** Picking the group maps out of a results folder the author chose, before uploading.
 *
 * A results folder holds far more than the maps we want: FSL's .gfeat has 4D residuals and
 * masks, SPM's has betas and ResMS. We pre-select the t/z, effect and variance maps, leave
 * out thresholded copies, and keep each file's path so the server can tell which effect
 * map sits beside which statistic map. When the folder holds more maps than the paper
 * takes, whole sets are ticked first: a t/z map, then its effect and variance maps. Names
 * here mirror the server's (store/backend/neurostore/outreach/map_sets.py), but only
 * choose what to suggest; the server reads each file's own header too. */

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
    if (kind === 'f') return 'tick it if an analysis is an F test';
    if (kind === 'other') return 'not recognised; tick it if it is a group map';
    return null;
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
    const isBeta = (map: Candidate) => Number(/beta/.test(map.file.name.toLowerCase()));
    const partner = (statistic: Candidate, kind: GuessedKind) =>
        wanted
            .filter((map) => map.kind === kind && setKey(map.path) === setKey(statistic.path))
            .sort((a, b) => isBeta(a) - isBeta(b))[0];
    const order = [
        ...wanted
            .filter((map) => STATISTIC.includes(map.kind))
            .flatMap((statistic) => [statistic, partner(statistic, 'effect'), partner(statistic, 'variance')]),
        ...wanted,
    ].filter((map): map is Candidate => map !== undefined);
    const chosen = new Set<Candidate>();
    for (const map of order) if (chosen.size < limit) chosen.add(map);
    for (const map of wanted) if (!chosen.has(map)) Object.assign(map, { selected: false, note: 'over the limit' });
    return maps;
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
