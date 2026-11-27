import type { Outcome, ShareUpload, ShareView } from './types';

export type Tone = 'success' | 'warning' | 'info' | 'error';

export const FITS: Record<Outcome, { label: string; tone: Tone }> = {
    match: { label: 'Peaks match', tone: 'success' },
    reversed_sign: { label: 'Opposite sign', tone: 'warning' },
    lr_flip: { label: 'Left/right swapped', tone: 'warning' },
    no_match: { label: 'Peaks not found', tone: 'warning' },
    cannot_assess: { label: "Can't check", tone: 'info' },
};

export interface Prompt {
    uploadId?: string;
    analysisKey?: string;
    tone: Tone;
    text: string;
}

/** Which uploads each analysis has. */
export function coverage(view: ShareView): Map<string, ShareUpload[]> {
    const byKey = new Map(view.analyses.map((analysis) => [analysis.key, [] as ShareUpload[]]));
    for (const upload of view.uploads) for (const key of upload.analysis_keys) byKey.get(key)?.push(upload);
    return byKey;
}

/** What the author should look at before submitting: files that do not fit the analysis
 * they are on, analyses with no file, files that are unusable or need a label. A file on
 * two analyses, one each side of its sign, is a contrast and its reverse: that is no
 * opposite-sign warning. */
export function prompts(view: ShareView): Prompt[] {
    const name = new Map(view.analyses.map((analysis) => [analysis.key, analysis.name]));
    // Asking which t/z map an effect map goes with only helps when there is one to pick;
    // an F map is no effect map's partner.
    const statistics = view.uploads.some(
        (upload) => (upload.map_type === 't' || upload.map_type === 'z') && upload.check_status === 'ok'
    );
    const found: Prompt[] = [];
    for (const upload of view.uploads) {
        if (upload.check_status === 'problem') {
            found.push({ uploadId: upload.id, tone: 'error', text: upload.problem ?? 'This file cannot be used.' });
            continue;
        }
        if (upload.thresholded)
            found.push({
                uploadId: upload.id,
                tone: 'info',
                text: 'This map looks thresholded. If you have the unthresholded one, please upload that instead.',
            });
        if (upload.kind === 'effect' || upload.kind === 'variance') {
            const partner = view.uploads.find((other) => other.id === upload.partner_id);
            if (!partner) {
                if (statistics)
                    found.push({
                        uploadId: upload.id,
                        tone: 'info',
                        text: `Which t or z map does this ${upload.kind} map go with? Pick it, so it goes with the same analysis.`,
                    });
            } else if (upload.reversed)
                found.push({
                    uploadId: upload.id,
                    tone: 'warning',
                    text: `This effect map runs opposite to ${partner.filename}. Is one of them the reverse contrast?`,
                });
            // Its analysis comes with its statistic map; effect maps are no test of it.
            if (partner) continue;
        }
        for (const key of upload.analysis_keys) {
            const outcome = upload.fits[key]?.outcome;
            const analysis = `“${name.get(key)}”`;
            if (outcome === 'no_match')
                found.push({
                    uploadId: upload.id,
                    analysisKey: key,
                    tone: 'warning',
                    text: `We couldn't find the peaks of ${analysis} in this file. Is it the right file?`,
                });
            else if (outcome === 'reversed_sign' && upload.analysis_keys.length === 1)
                found.push({
                    uploadId: upload.id,
                    analysisKey: key,
                    tone: 'warning',
                    text: `This file looks like the opposite contrast of ${analysis}.`,
                });
            else if (outcome === 'lr_flip')
                found.push({
                    uploadId: upload.id,
                    analysisKey: key,
                    tone: 'warning',
                    text: `Left and right look swapped compared with ${analysis}.`,
                });
        }
        if (upload.analysis_keys.length === 0 && !upload.label && upload.kind !== 'variance')
            found.push({
                uploadId: upload.id,
                tone: 'info',
                text: 'Which analysis is this map? Pick one, or describe it if the paper does not table it.',
            });
    }
    for (const [key, uploads] of coverage(view))
        if (uploads.length === 0)
            found.push({
                analysisKey: key,
                tone: 'info',
                text: `No file for “${name.get(key)}” yet. Pick one, or leave it if you don't have it.`,
            });
    return found;
}

export const usableFiles = (view: ShareView) => view.uploads.filter((upload) => upload.check_status === 'ok');

export function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why a file cannot be uploaded before it is sent, or null. */
export function refusal(file: File, view: ShareView, queued: number): string | null {
    const lowered = file.name.toLowerCase();
    if (!view.limits.extensions.some((ext) => lowered.endsWith(ext))) return 'Only .nii and .nii.gz files.';
    if (file.size > view.limits.max_file_bytes) return 'Files over 200 MB are not supported.';
    if (view.uploads.length + queued >= view.limits.max_files)
        return `This paper takes at most ${view.limits.max_files} files.`;
    return null;
}

/** The folder every path sits in, so rows can show only what tells them apart. Empty
 * when any file came without its folder or the paths share none. */
export function commonFolder(paths: (string | null)[]): string {
    if (paths.length === 0 || paths.some((path) => !path)) return '';
    const folders = paths.map((path) => path!.split('/').slice(0, -1));
    const shared: string[] = [];
    for (const [index, segment] of folders[0].entries()) {
        if (!folders.every((folder) => folder[index] === segment)) break;
        shared.push(segment);
    }
    return shared.join('/');
}

/** ``path`` without the ``folder`` it sits in. */
export const inFolder = (path: string, folder: string) =>
    folder && path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;

/** The uploads in reading order: each statistic map, then the maps that go with it. */
export function ordered(view: ShareView): ShareUpload[] {
    const ids = new Set(view.uploads.map((upload) => upload.id));
    const leaders = view.uploads.filter((upload) => !upload.partner_id || !ids.has(upload.partner_id));
    return leaders.flatMap((leader) => [leader, ...view.uploads.filter((upload) => upload.partner_id === leader.id)]);
}

export const TYPE_LABELS: Record<string, string> = {
    t: 't map',
    z: 'z map',
    f: 'F map',
    effect: 'effect map',
    variance: 'variance map',
    other: 'other',
};
