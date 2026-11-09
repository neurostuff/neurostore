import { defaultSoftware } from './instructions';
import {
    filesUnder,
    filterCandidates,
    groupByFolder,
    guessKind,
    hasSimilarMap,
    pickMaps,
    setKey,
    similarMaps,
    swapMaps,
} from './tree';

const at = (path: string, size = 1000) => ({ file: new File([new Uint8Array(size)], path.split('/').pop()!), path });

test('an FSL group folder gives its z, effect and variance maps, not the rest', () => {
    const picked = pickMaps(
        [
            at('group.gfeat/cope1.feat/stats/zstat1.nii.gz'),
            at('group.gfeat/cope1.feat/stats/tstat1.nii.gz'),
            at('group.gfeat/cope1.feat/stats/cope1.nii.gz'),
            at('group.gfeat/cope1.feat/stats/varcope1.nii.gz'),
            at('group.gfeat/cope1.feat/thresh_zstat1.nii.gz'),
            at('group.gfeat/cope1.feat/filtered_func_data.nii.gz'),
            at('group.gfeat/cope1.feat/mask.nii.gz'),
            at('group.gfeat/cope1.feat/stats/mean_random_effects_var1.nii.gz'),
            at('group.gfeat/cope1.feat/report.html'),
        ],
        10
    );
    const selected = picked.filter((c) => c.selected).map((c) => c.path.split('/').pop());
    expect(selected).toEqual(['cope1.nii.gz', 'varcope1.nii.gz', 'zstat1.nii.gz']);
    expect(picked.find((c) => c.path.endsWith('tstat1.nii.gz'))?.note).toBe('its z map is selected');
    expect(picked.some((c) => c.path.endsWith('report.html'))).toBe(false);
});

test('SPM, nilearn and FitLins names are told apart', () => {
    expect(
        [
            'spmT_0001.nii',
            'con_0001.nii',
            'faces_effect_size.nii.gz',
            'x_stat-variance_statmap.nii.gz',
            'AllFoodsValuation_Beta.nii.gz',
            'AllFoodsValuation_T.nii.gz',
        ].map(guessKind)
    ).toEqual(['t', 'effect', 'effect', 'variance', 'effect', 't']);
});

test('no more maps are pre-selected than the paper takes', () => {
    const picked = pickMaps([at('a/zstat1.nii.gz'), at('b/zstat1.nii.gz'), at('c/zstat1.nii.gz')], 2);
    expect(picked.filter((c) => c.selected)).toHaveLength(2);
    expect(picked[2].note).toBe('over the limit');
});

test('over the limit, whole sets are ticked before more t maps or stray betas', () => {
    const picked = pickMaps(
        [
            'beta_0001.nii',
            'beta_0002.nii',
            'con_0001.nii',
            'con_0002.nii',
            'con_0003.nii',
            'spmT_0001.nii',
            'spmT_0002.nii',
            'spmT_0003.nii',
            'RPV.nii',
            'mask.nii',
        ].map((name) => at(`level2/${name}`)),
        4
    );
    const selected = picked.filter((c) => c.selected).map((c) => c.path.split('/').pop());
    expect(selected).toEqual(['con_0001.nii', 'con_0002.nii', 'spmT_0001.nii', 'spmT_0002.nii']);
    expect(picked.find((c) => c.path.endsWith('spmT_0003.nii'))?.note).toBe('over the limit');
    expect(picked.find((c) => c.path.endsWith('beta_0001.nii'))?.note).toBe('over the limit');
    expect(picked.find((c) => c.path.endsWith('RPV.nii'))?.note).toBe('not a group map');
});

test('renamed maps pair by their shared stem', () => {
    const picked = pickMaps(
        ['A_Beta', 'A_T', 'B_Beta', 'B_T', 'C_Beta', 'C_T'].map((name) => at(`maps/${name}.nii.gz`)),
        4
    );
    expect(picked.filter((c) => c.selected).map((c) => c.path.split('/').pop())).toEqual([
        'A_Beta.nii.gz',
        'A_T.nii.gz',
        'B_Beta.nii.gz',
        'B_T.nii.gz',
    ]);
    expect(setKey('g/cope1.feat/stats/zstat1.nii.gz')).toBe(setKey('g/cope1.feat/stats/varcope1.nii.gz'));
    expect(setKey('a/zstat1.nii.gz')).not.toBe(setKey('b/cope1.nii.gz'));
});

test('files left unticked say why in plain words', () => {
    const picked = pickMaps([at('x/thresh_zstat1.nii.gz'), at('x/spmF_0002.nii'), at('x/Rob.3dMVM.nii.gz')], 10);
    expect(picked.map((c) => c.note)).toEqual([
        'not recognised; select it if it is a group map',
        'select it if an analysis is an F test',
        'thresholded copy',
    ]);
    expect(picked.some((c) => c.selected)).toBe(false);
});

const names = (maps: { path: string }[]) => maps.map((map) => map.path.split('/').slice(-2).join('/'));
const feat = (n: number) => [`g.gfeat/cope${n}.feat/stats/zstat1.nii.gz`, `g.gfeat/cope${n}.feat/stats/cope1.nii.gz`];
const folderPick = (count: number, limit: number) =>
    pickMaps(
        Array.from({ length: count }, (_, i) => feat(i + 1))
            .flat()
            .map((path) => at(path)),
        limit
    );
const selectedOf = (maps: { selected: boolean; path: string }[]) =>
    new Set(maps.filter((m) => m.selected).map((m) => m.path));

test('the filter keeps maps whose path holds every word, in any case', () => {
    const picked = folderPick(3, 10);
    expect(filterCandidates(picked, '')).toHaveLength(picked.length);
    expect(names(filterCandidates(picked, 'COPE2 zstat'))).toEqual(['stats/zstat1.nii.gz']);
    expect(filterCandidates(picked, 'cope2').every((map) => map.path.includes('cope2'))).toBe(true);
    expect(filterCandidates(picked, 'nothing')).toEqual([]);
});

test('maps are grouped by the folder they sit in, in order, named relative to the chosen folder', () => {
    const picked = folderPick(2, 10);
    const groups = groupByFolder(picked, 'g.gfeat');
    expect(groups.map((group) => group.folder)).toEqual(['cope1.feat/stats', 'cope2.feat/stats']);
    expect(names(groups[1].maps)).toEqual(['stats/cope1.nii.gz', 'stats/zstat1.nii.gz']);
    expect(groupByFolder(pickMaps([at('x.nii.gz')], 1), '')[0].folder).toBe('');
});

test('similar maps are the unticked ones of the same kind, nearest in the folder tree first', () => {
    const picked = [...folderPick(4, 1), ...pickMaps([at('other/zstat9.nii.gz'), at('other/mask.nii.gz')], 0)];
    const ticked = picked.find((map) => map.selected)!;
    const similar = similarMaps(ticked, picked, selectedOf(picked));
    expect(names(similar)).toEqual([
        'stats/zstat1.nii.gz',
        'stats/zstat1.nii.gz',
        'stats/zstat1.nii.gz',
        'other/zstat9.nii.gz',
    ]);
    expect(similar.slice(0, 3).every((map) => map.path.startsWith('g.gfeat/'))).toBe(true);
    expect(similar.every((map) => map.kind === 'z')).toBe(true);
});

test('similar maps leave out thresholded copies, files that are not group maps and ticked maps', () => {
    const picked = pickMaps(
        ['a/zstat1', 'a/zstat2', 'a/thresh_zstat3', 'a/mask_zstat4'].map((name) => at(`${name}.nii.gz`)),
        1
    );
    const ticked = picked.find((map) => map.selected)!;
    expect(ticked.path).toBe('a/zstat1.nii.gz');
    expect(names(similarMaps(ticked, picked, selectedOf(picked)))).toEqual(['a/zstat2.nii.gz']);
});

test('hasSimilarMap says whether similarMaps would find anything', () => {
    const some = pickMaps(
        ['a/zstat1', 'a/zstat2', 'a/thresh_zstat3'].map((n) => at(`${n}.nii.gz`)),
        1
    );
    const ticked = some.find((map) => map.selected)!;
    expect(hasSimilarMap(ticked, some, selectedOf(some))).toBe(true);
    // Nothing left to offer once the only other candidate is ticked.
    const alone = pickMaps(
        ['a/zstat1', 'a/thresh_zstat3', 'a/mask_zstat4'].map((n) => at(`${n}.nii.gz`)),
        1
    );
    const only = alone.find((map) => map.selected)!;
    expect(similarMaps(only, alone, selectedOf(alone))).toEqual([]);
    expect(hasSimilarMap(only, alone, selectedOf(alone))).toBe(false);
});

test('a t map and a z map count as alike, an effect map only looks for effect maps', () => {
    const picked = pickMaps(
        ['a/spmT_0001', 'a/spmT_0002', 'a/con_0001', 'a/con_0002'].map((n) => at(`${n}.nii`)),
        2
    );
    const [con1, t1] = ['con_0001', 'spmT_0001'].map((n) => picked.find((map) => map.path.includes(n))!);
    expect(names(similarMaps(t1, picked, selectedOf(picked)))).toEqual(['a/spmT_0002.nii']);
    expect(names(similarMaps(con1, picked, selectedOf(picked)))).toEqual(['a/con_0002.nii']);
});

test('swapping a t/z map swaps the effect map that goes with it, and only the kinds the old set had', () => {
    const picked = folderPick(3, 2);
    const selected = selectedOf(picked);
    const from = picked.find((map) => map.path === 'g.gfeat/cope1.feat/stats/zstat1.nii.gz')!;
    const to = picked.find((map) => map.path === 'g.gfeat/cope3.feat/stats/zstat1.nii.gz')!;
    const { removed, added } = swapMaps(from, to, picked, selected);
    expect(removed.map((map) => map.path)).toEqual([
        'g.gfeat/cope1.feat/stats/zstat1.nii.gz',
        'g.gfeat/cope1.feat/stats/cope1.nii.gz',
    ]);
    expect(added.map((map) => map.path)).toEqual([
        'g.gfeat/cope3.feat/stats/zstat1.nii.gz',
        'g.gfeat/cope3.feat/stats/cope1.nii.gz',
    ]);
});

test("swapping a set with no variance map does not bring in the other set's variance map", () => {
    const picked = pickMaps(
        ['a/cope1', 'a/zstat1', 'b/cope1', 'b/varcope1', 'b/zstat1'].map((n) => at(`${n}.nii.gz`)),
        2
    );
    const from = picked.find((map) => map.path === 'a/zstat1.nii.gz')!;
    const to = picked.find((map) => map.path === 'b/zstat1.nii.gz')!;
    const { added } = swapMaps(from, to, picked, selectedOf(picked));
    expect(added.map((map) => map.path)).toEqual(['b/zstat1.nii.gz', 'b/cope1.nii.gz']);
});

test('swapping a lone effect map swaps just that map', () => {
    const picked = pickMaps(
        ['a', 'b', 'c'].map((folder) => at(`${folder}/cope1.nii.gz`)),
        1
    );
    const from = picked.find((map) => map.selected)!;
    expect(from.kind).toBe('effect');
    const to = picked.find((map) => map.path === 'b/cope1.nii.gz')!;
    const { removed, added } = swapMaps(from, to, picked, selectedOf(picked));
    expect([removed, added].map((maps) => maps.length)).toEqual([1, 1]);
});

const fileEntry = (path: string) =>
    ({
        isFile: true,
        isDirectory: false,
        fullPath: `/${path}`,
        file: (resolve: (file: File) => void) => resolve(new File(['x'], path.split('/').pop()!)),
    }) as unknown as FileSystemEntry;

const folderEntry = (path: string, children: FileSystemEntry[]) => {
    let given = 0;
    return {
        isFile: false,
        isDirectory: true,
        fullPath: `/${path}`,
        createReader: () => ({
            // The real API hands out at most 100 entries per call.
            readEntries: (resolve: (batch: FileSystemEntry[]) => void) => {
                const batch = children.slice(given, given + 100);
                given += batch.length;
                resolve(batch);
            },
        }),
    } as unknown as FileSystemEntry;
};

test('a dropped folder is walked whole, past the 100-entry read batches', async () => {
    const stats = Array.from({ length: 120 }, (_, i) => fileEntry(`results/stats/zstat${i + 1}.nii.gz`));
    const dropped = folderEntry('results', [folderEntry('results/stats', stats), fileEntry('results/cope1.nii.gz')]);
    const found = await filesUnder(dropped);
    expect(found).toHaveLength(121);
    const paths = found.map(({ path }) => path);
    expect(paths).toContain('results/stats/zstat120.nii.gz');
    expect(paths).toContain('results/cope1.nii.gz');
});

test('instructions open on the first package the paper reports that we know', () => {
    expect(defaultSoftware(['fMRIPrep', 'FSL'])).toBe('FSL');
    expect(defaultSoftware(['BrainVoyager'])).toBe('Other');
    expect(defaultSoftware(undefined)).toBe('Other');
});
