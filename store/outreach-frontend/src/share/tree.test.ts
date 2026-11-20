import { defaultSoftware } from './instructions';
import { filesUnder, guessKind, pickMaps, setKey } from './tree';

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
        'not recognised; tick it if it is a group map',
        'tick it if an analysis is an F test',
        'thresholded copy',
    ]);
    expect(picked.some((c) => c.selected)).toBe(false);
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
