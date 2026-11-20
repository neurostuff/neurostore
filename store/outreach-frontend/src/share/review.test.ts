import { renderToStaticMarkup } from 'react-dom/server';
import { tokenFrom } from './api';
import { byUploadFolder, commonFolder, inFolder, parentFolder, planUpload, prompts } from './review';
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

const texts = (v: ShareView) =>
    prompts(v).map(
        (p) => p.text || renderToStaticMarkup(p.body).replace(/<br\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&gt;/g, '>'),
    );

test('a file that fits its analysis raises nothing', () => {
    expect(texts(view([upload('1', ['a'], { a: fit('match') }), upload('2', ['b'], { b: fit('match') })]))).toEqual([]);
});

test('a file whose peaks are not found, or flipped, asks the author to check it', () => {
    const found = texts(view([upload('1', ['a'], { a: fit('no_match') }), upload('2', ['b'], { b: fit('lr_flip') })]));
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
        'Which analysis is this map? Move it to one, or describe it if the paper does not table it.',
        'This map holds no numbers.',
        "No map for “Houses > Faces” yet. This is nonblocking - you can submit anyway.",
    ]);
});

const chosen = (name: string, path?: string) => ({ file: new File(['x'], name), path });

test('only new NIfTI files are sent; other files in a folder are passed over without comment', () => {
    const v = view([upload('1', ['a'], {}, { path: 'study/old.nii.gz' })]);
    const plan = planUpload(
        [
            chosen('a.nii.gz', 'study/a.nii.gz'),
            chosen('notes.txt', 'study/notes.txt'),
            chosen('old.nii.gz', 'study/old.nii.gz'),
        ],
        v
    );
    expect(plan.accepted.map((item) => item.path)).toEqual(['study/a.nii.gz']);
    expect(plan.refused).toEqual([]);
    expect(plan.over).toBe(0);
    expect(plan.empty).toBe(false);
});

test('a choice with no NIfTI file in it is empty', () => {
    expect(planUpload([chosen('readme.md')], view([])).empty).toBe(true);
});

test('a file over the size limit is named, and does not use up room', () => {
    const v = view([]);
    const big = { file: new File(['x'], 'big.nii.gz'), path: 'f/big.nii.gz' };
    Object.defineProperty(big.file, 'size', { value: v.limits.max_file_bytes + 1 });
    const plan = planUpload([big, chosen('ok.nii.gz', 'f/ok.nii.gz')], v);
    expect(plan.refused).toEqual([{ name: 'f/big.nii.gz', reason: 'Files over 200 MB are not supported.' }]);
    expect(plan.accepted).toHaveLength(1);
});

test('files past the limit are left out whole and counted', () => {
    const v = view([upload('1', [], {}, { path: 'a/1.nii.gz' }), upload('2', [], {}, { path: 'a/2.nii.gz' })]);
    const files = ['x', 'y', 'z', 'w'].map((name) => chosen(`${name}.nii.gz`, `b/${name}.nii.gz`));
    const plan = planUpload(files, v); // the view allows four files and holds two
    expect(plan.accepted.map((item) => item.path)).toEqual(['b/x.nii.gz', 'b/y.nii.gz']);
    expect(plan.over).toBe(2);
});

test('uploads are grouped by the folder they were chosen from, loose files apart', () => {
    const v = view([
        upload('1', [], {}, { path: 'study1/stats/z.nii.gz' }),
        upload('2', [], {}, { path: 'study2/stats/z.nii.gz' }),
        upload('3', [], {}, { path: 'study1/stats/c.nii.gz' }),
        upload('4', [], {}, { path: null }),
    ]);
    const groups = byUploadFolder(v);
    expect(groups.map((group) => group.folder)).toEqual(['study1', 'study2', null]);
    expect(groups[0].uploads.map((item) => item.inside)).toEqual(['stats/c.nii.gz', 'stats/z.nii.gz']);
    expect(groups[2].uploads.map((item) => item.inside)).toEqual(['4.nii.gz']);
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
        'Which t or z map does this variance map go with? Select or upload it, so it goes with the same analysis.',
        "No map for “Houses > Faces” yet. This is nonblocking - you can submit anyway.",
    ]);
    const reversed = upload('e', ['a'], {}, { kind: 'effect', partner_id: 'z', reversed: true });
    expect(texts(view([z, reversed]))[0]).toBe(
        'This effect map runs opposite to z.nii.gz. Is one of them the reverse contrast?'
    );
});

test('an effect map is not asked for its t/z map when none was uploaded', () => {
    const effect = upload('e', ['a'], { a: fit('match') }, { kind: 'effect', map_type: 'effect' });
    const found = texts(view([effect]));
    expect(found.some((text) => text.startsWith('Which t or z map'))).toBe(false);
    expect(found).toEqual(["No map for “Houses > Faces” yet. This is nonblocking - you can submit anyway."]);
    // F maps for an F-test analysis are no t/z map to pick either
    const f = upload('f', ['b'], { b: fit('match') }, { map_type: 'f' });
    expect(texts(view([effect, f])).some((text) => text.startsWith('Which t or z map'))).toBe(false);
});

test('coverage prompts carry no uploadId, so the submit summary can pick them out', () => {
    const found = prompts(view([upload('1', ['a'], { a: fit('no_match') })]));
    expect(found.filter((prompt) => !prompt.uploadId).map((prompt) => prompt.analysisKey)).toEqual(['b']);
    expect(found.filter((prompt) => prompt.uploadId)).toHaveLength(1);
});

test('rows drop the folder their files share', () => {
    const folder = commonFolder([
        'paper/group.gfeat/cope1.feat/stats/zstat1.nii.gz',
        'paper/group.gfeat/cope2.feat/stats/zstat1.nii.gz',
    ]);
    expect(folder).toBe('paper/group.gfeat');
    expect(inFolder('paper/group.gfeat/cope1.feat/stats/zstat1.nii.gz', folder)).toBe('cope1.feat/stats/zstat1.nii.gz');
    expect(commonFolder(['paper/a.nii', null])).toBe('');
    expect(commonFolder(['a.nii', 'b.nii'])).toBe('');
    expect(inFolder('a.nii', '')).toBe('a.nii');
});

test("a map's folder is the one it sits in, and a loose file has none", () => {
    expect(parentFolder(upload('1', [], {}, { path: 'study/cope1.feat/stats/z.nii.gz' }))).toBe('stats');
    expect(parentFolder(upload('2', [], {}, { path: 'study/z.nii.gz' }))).toBe('study');
    expect(parentFolder(upload('3', [], {}, { path: null }))).toBeNull();
    expect(parentFolder(upload('4', [], {}, { path: 'z.nii.gz' }))).toBeNull();
});
