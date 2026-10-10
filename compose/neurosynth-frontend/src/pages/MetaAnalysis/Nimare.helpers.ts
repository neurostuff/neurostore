// this is organized as an array to make it orderable. Order is obtained from: https://nimare.readthedocs.io/en/stable/outputs.html#file-names
export const NimareOutputs = [
    // possible data types
    { key: 'z', label: 'type', description: 'Z-statistic' },
    { key: 't', label: 'type', description: 'T-statistic' },
    { key: 'p', label: 'type', description: 'p-value' },
    { key: 'logp', label: 'type', description: 'Negative base-ten logarithm of p-value' },
    { key: 'chi2', label: 'type', description: 'Chi-squared value' },
    { key: 'prob', label: 'type', description: 'Probability value' },
    {
        key: 'stat',
        label: 'type',
        description: 'Test value of meta-analytic algorithm (e.g., ALE values for ALE, OF values for MKDA)',
    },
    { key: 'est', label: 'type', description: 'Parameter estimate (IBMA only)' },
    { key: 'se', label: 'type', description: 'Standard error of the parameter estimate (IBMA only)' },
    { key: 'tau2', label: 'type', description: 'Estimated between-study variance (IBMA only)' },
    { key: 'sigma2', label: 'type', description: 'Estimated within-study variance (IBMA only)' },
    { key: 'label', label: 'type', description: 'Label map' },
    // IBMA degrees-of-freedom map. Kept after the statistical maps so it sorts last.
    { key: 'dof', label: 'type', description: 'Degrees of freedom (IBMA only)' },
    // KVPs that describe the methods applied to generate the meta analysis
    {
        key: 'desc',
        label: 'description',
        description:
            'Description of the data type. Only used when multiple maps with the same data type are produced by the same method.',
    },
    {
        key: 'level',
        label: 'level',
        description: 'Level of multiple comparisons correction. Either cluster or voxel.',
    },
    {
        key: 'corr',
        label: 'correction',
        description:
            'Type of multiple comparisons correction. Either FWE (familywise error rate) or FDR (false discovery rate).',
    },
    {
        key: 'method',
        label: 'method',
        description:
            'Name of the method used for multiple comparisons correction (e.g., “montecarlo” for a Monte Carlo procedure).',
    },
    {
        key: 'diag',
        label: 'diagnostic',
        description:
            'Type of diagnostic. Either Jackknife (jackknife analysis) or FocusCounter (focus-count analysis).',
    },
    {
        key: 'tab',
        label: 'table',
        description: 'Type of table. Either clust (clusters table) or counts (contribution table).',
    },
    { key: 'tail', label: 'tail', description: 'Sign of the tail for label maps. Either positive or negative.' },
];

export const parseNimareFileName = (
    fileName: string | undefined | null
): { key: string; label: string; description: string; value: string }[] => {
    // we expect filenames of the form: z_desc-somedescription_level-voxel_corr-fwe_method-montecarlo.nii.gz
    if (!fileName) return [];
    const segments = fileName.replace('.nii.gz', '').split('_');
    return segments.map((segment) => {
        const [key, value] = segment.split('-');
        const associatedNimareOutput = NimareOutputs.find((output) => output.key === key);

        if (associatedNimareOutput === undefined) {
            // unrecognized KVP in file name
            return {
                key: key,
                label: 'unknown field',
                description: '',
                value: key,
            };
        } else if (value === undefined) {
            // data type, not a method. The key is also the value
            return {
                ...associatedNimareOutput,
                value: key,
            };
        } else {
            // KVPs describing methods applied to generate the map
            return {
                ...associatedNimareOutput,
                value: value,
            };
        }
    });
};

export const formatNimareMethodDescription = async (
    methodDescription: string,
    methodReferences: string | null | undefined
): Promise<{ description: string; references: string }> => {
    // @ts-expect-error citation-js packages do not provide first-party TS types
    const citationCore = await import('@citation-js/core');
    // @ts-expect-error citation-js packages do not provide first-party TS types
    await import('@citation-js/plugin-bibtex');
    // @ts-expect-error citation-js packages do not provide first-party TS types
    await import('@citation-js/plugin-csl');

    const apa = { template: 'apa', lang: 'en-US' } as const;
    const cite = new citationCore.Cite(methodReferences || '');
    const knownIds = new Set(cite.data.map((entry: { id: string }) => entry.id));

    // APA citation() returns "(Author, year)"; strip the parens so each command can wrap differently.
    // For example, formats "wager2007meta" => "Wager et al., 2007"
    const formatKey = (key: string) => {
        if (!knownIds.has(key)) return key;
        return String(cite.format('citation', { ...apa, entry: key })).slice(1, -1);
    };

    // NiMARE: \citep{a,b} -> (A, 2020; B, 2021); \citealt{a} -> A, 2020; \cite{a} -> A (2020)
    const description = methodDescription.replace(
        /\\(citep|citealt|cite)\{([^}]+)\}/g,
        (_match, command: string, rawKeys: string) => {
            const parts = rawKeys.split(',').map((key) => formatKey(key.trim()));
            if (command === 'citep') return `(${parts.join('; ')})`;
            if (command === 'citealt') return parts.join('; ');
            return parts.map((part) => part.replace(/, ([^,]+)$/, ' ($1)')).join('; ');
        }
    );

    return {
        description,
        references: String(cite.format('bibliography', { format: 'text', ...apa })).trim(),
    };
};
