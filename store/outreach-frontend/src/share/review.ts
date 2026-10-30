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
        if (upload.analysis_keys.length === 0 && !upload.label)
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
