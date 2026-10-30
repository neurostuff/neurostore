/** Where an author's maps are, by the software that made them. The page opens on the
 * software the paper reports and lets the author switch. */

export interface Instructions {
    software: string;
    /** Which folder to choose. */
    folder: string;
    /** Which files are the maps, in that folder. */
    files: string[];
    /** A step to take first, when the software does not write NIfTI maps as they are. */
    before?: string;
}

export const INSTRUCTIONS: Instructions[] = [
    {
        software: 'FSL',
        folder: 'the group analysis folder (the one ending in .gfeat).',
        files: [
            'copeN.feat/stats/zstat1.nii.gz: the z map of each contrast',
            'copeN.feat/stats/cope1.nii.gz: its effect map',
            'copeN.feat/stats/varcope1.nii.gz: its variance (optional)',
        ],
    },
    {
        software: 'SPM',
        folder: 'the second-level folder that holds SPM.mat.',
        files: ['spmT_000N.nii: the t map of each contrast', 'con_000N.nii: its effect (contrast) map'],
    },
    {
        software: 'AFNI',
        folder: 'the folder you saved the converted maps to.',
        before:
            'AFNI keeps group results as sub-bricks of a bucket (3dttest++, 3dMEMA). Convert the mean and the t or z sub-brick of each contrast to NIfTI first, for example 3dAFNItoNIFTI -prefix faces_z.nii.gz "results+tlrc[faces_Zscr]".',
        files: ['the t or z map of each contrast', 'its mean (effect) map'],
    },
    {
        software: 'nilearn',
        folder: 'the folder you saved the second-level maps to.',
        before:
            'compute_contrast(..., output_type="all") returns z_score, stat, effect_size and effect_variance; save each with .to_filename().',
        files: ['…z_score.nii.gz: the z map', '…effect_size.nii.gz: the effect map', '…effect_variance.nii.gz (optional)'],
    },
    {
        software: 'FitLins',
        folder: 'the FitLins output folder for the group level.',
        files: [
            '…_stat-z_statmap.nii.gz: the z map',
            '…_stat-effect_statmap.nii.gz: the effect map',
            '…_stat-variance_statmap.nii.gz (optional)',
        ],
    },
    {
        software: 'Other',
        folder: 'the folder that holds your group-level results.',
        files: [
            'the unthresholded t or z map of each analysis',
            'its effect map (beta, contrast or mean), if you have it',
        ],
    },
];

/** The instructions for the first package the paper reports that we have any for. */
export function defaultSoftware(packages: string[] | undefined): string {
    const known = new Set(INSTRUCTIONS.map((item) => item.software));
    return packages?.find((name) => known.has(name)) ?? 'Other';
}
