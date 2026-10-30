import { tokenFrom } from './api';
import { prompts, refusal } from './review';
import type { Fit, ShareUpload, ShareView } from './types';

const fit = (outcome: Fit['outcome']): Fit => ({ outcome, score: 0.9, reason: null });

const upload = (
    id: string,
    keys: string[],
    fits: Record<string, Fit | null> = {},
    over: Partial<ShareUpload> = {}
): ShareUpload => ({
    id,
    filename: `${id}.nii.gz`,
    path: null,
    kind: 'statistic',
    map_type_by: 'name',
    partner_id: null,
    partner_r: null,
    partner_by: null,
    reversed: false,
    size_bytes: 1000,
    check_status: 'ok',
    problem: null,
    thresholded: false,
    analysis_keys: keys,
    assigned_by: 'suggestion',
    label: null,
    map_type: 'z',
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
    software: null,
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

test('an effect map follows its t/z map, and one without a partner asks for it', () => {
    const z = upload('z', ['a'], { a: fit('match') });
    const paired = upload('e', ['a'], { a: fit('no_match') }, { kind: 'effect', partner_id: 'z' });
    const alone = upload('v', [], {}, { kind: 'variance' });
    const found = texts(view([z, paired, alone]));
    // No "peaks not found" for the paired effect map: its analysis comes from its t/z map.
    expect(found).toEqual([
        'Which t or z map does this variance map go with? Pick it, so it goes with the same analysis.',
        "No file for “Houses > Faces” yet. Pick one, or leave it if you don't have it.",
    ]);
    const reversed = upload('e', ['a'], {}, { kind: 'effect', partner_id: 'z', reversed: true });
    expect(texts(view([z, reversed]))[0]).toBe('This effect map runs opposite to z.nii.gz. Is one of them the reverse contrast?');
});
