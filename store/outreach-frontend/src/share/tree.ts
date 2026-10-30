/** Picking the group maps out of a results folder the author chose, before uploading.
 *
 * A results folder holds far more than the maps we want: FSL's .gfeat has 4D residuals and
 * masks, SPM's has betas and ResMS. We pre-select the t/z, effect and variance maps, leave
 * out thresholded copies, and keep each file's path so the server can tell which effect
 * map sits beside which statistic map. Names here mirror the server's
 * (store/backend/neurostore/outreach/map_sets.py), but only choose what to suggest; the
 * server reads each file's own header too. */

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
const NIFTI = /\.nii(\.gz)?$/i;

export function guessKind(name: string): GuessedKind {
    const stem = name.toLowerCase().replace(NIFTI, '');
    return RULES.find(([, pattern]) => pattern.test(stem))?.[0] ?? 'other';
}

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');
const numberOf = (name: string) => name.match(/(\d+)(?!.*\d)/)?.[1]?.replace(/^0+(?=\d)/, '') ?? '';

/** The maps in a chosen folder, the likely ones selected, up to ``limit`` of them. */
export function pickMaps(files: { file: File; path: string }[], limit: number): Candidate[] {
    const maps = files
        .filter(({ file }) => NIFTI.test(file.name))
        .map(({ file, path }) => {
            const name = file.name.toLowerCase();
            const kind = guessKind(name);
            const skipped = SKIP.test(name) || kind === 'other' || kind === 'f';
            return {
                file,
                path,
                kind,
                selected: !skipped,
                note: SKIP.test(name) ? 'not a group map' : kind === 'f' ? 'F map' : kind === 'other' ? 'unrecognised' : null,
            };
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
    let chosen = 0;
    for (const map of maps) {
        if (!map.selected) continue;
        if (chosen >= limit) Object.assign(map, { selected: false, note: 'over the limit' });
        else chosen += 1;
    }
    return maps;
}

/** A folder's files with their paths inside it, from an <input webkitdirectory>. */
export const withPaths = (files: FileList | File[]) =>
    Array.from(files).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
