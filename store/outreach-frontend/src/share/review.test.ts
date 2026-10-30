import { tokenFrom } from './api';
import { prompts, refusal } from './review';
import type { Fit, ShareUpload, ShareView } from './types';

const fit = (outcome: Fit['outcome']): Fit => ({ outcome, score: 0.9, reason: null });

const upload = (id: string, keys: string[], fits: Record<string, Fit | null> = {}, over: Partial<ShareUpload> = {}) => ({
    id,
    filename: `${id}.nii.gz`,
    size_bytes: 1000,
    check_status: 'ok' as const,
    problem: null,
    thresholded: false,
    analysis_keys: keys,
    assigned_by: 'suggestion' as const,
    label: null,
    map_type: null,
    fits,
    ...over,
});

const view = (uploads: ShareUpload[]): ShareView => ({
    preview: false,
    status: 'uploading',
    open: true,
    closed_reason: null,
    paper: { title: 'A paper', journal: null, year: 2026, authors: null, doi: null, pmid: null, pmcid: null },
    analyses: [
        { key: 'a', name: 'Faces > Houses', description: null, points: 5 },
        { key: 'b', name: 'Houses > Faces', description: null, points: 5 },
    ],
    collection: {},
    uploads,
    issues: [],
    submitter_name: null,
    submitter_orcid: null,
    limits: { max_files: 4, max_file_bytes: 200 * 1024 * 1024, extensions: ['.nii.gz', '.nii'], map_types: [] },
});

const texts = (v: ShareView) => prompts(v).map((p) => p.text);

test('a file that fits its analysis raises nothing', () => {
    expect(texts(view([upload('1', ['a'], { a: fit('match') }), upload('2', ['b'], { b: fit('match') })]))).toEqual([]);
});

test('a file whose peaks are not found, or flipped, asks the author to check it', () => {
    const found = texts(
        view([upload('1', ['a'], { a: fit('no_match') }), upload('2', ['b'], { b: fit('lr_flip') })])
    );
    expect(found).toEqual([
        "We couldn't find the peaks of “Faces > Houses” in this file. Is it the right file?",
        'Left and right look swapped compared with “Houses > Faces”.',
    ]);
});

test('one map carrying a contrast and its reverse is no opposite-sign warning', () => {
    const both = upload('1', ['a', 'b'], { a: fit('match'), b: fit('reversed_sign') });
    expect(texts(view([both]))).toEqual([]);
    const alone = upload('1', ['b'], { b: fit('reversed_sign') });
    expect(texts(view([alone]))).toContain('This file looks like the opposite contrast of “Houses > Faces”.');
});

test('analyses with no file, unlabelled leftovers and unusable files are listed', () => {
    const found = texts(
        view([
            upload('1', ['a'], { a: fit('match') }),
            upload('2', []),
            upload('3', [], {}, { check_status: 'problem', problem: 'This map holds no numbers.' }),
        ])
    );
    expect(found).toEqual([
        'Which analysis is this map? Pick one, or describe it if the paper does not table it.',
        'This map holds no numbers.',
        "No file for “Houses > Faces” yet. Pick one, or leave it if you don't have it.",
    ]);
});

test('files are refused before upload for their type, size or number', () => {
    const v = view([upload('1', ['a']), upload('2', ['b']), upload('3', [])]);
    expect(refusal(new File(['x'], 'map.txt'), v, 0)).toBe('Only .nii and .nii.gz files.');
    expect(refusal(new File(['x'], 'map.nii.gz'), v, 0)).toBeNull();
    expect(refusal(new File(['x'], 'map.nii.gz'), v, 1)).toBe('This paper takes at most 4 files.');
});

test("the link's token is read from the URL's fragment", () => {
    expect(tokenFrom('#abc-123_X')).toBe('abc-123_X');
    expect(tokenFrom('')).toBeNull();
});
