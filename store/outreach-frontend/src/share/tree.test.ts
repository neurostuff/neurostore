import { defaultSoftware } from './instructions';
import { guessKind, pickMaps } from './tree';

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

test('instructions open on the first package the paper reports that we know', () => {
    expect(defaultSoftware(['fMRIPrep', 'FSL'])).toBe('FSL');
    expect(defaultSoftware(['BrainVoyager'])).toBe('Other');
    expect(defaultSoftware(undefined)).toBe('Other');
});
