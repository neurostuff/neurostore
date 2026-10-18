export const STEPS = [
    {
        id: 'coordinates',
        label: 'Coordinates',
        hint: 'Check each coordinate analysis: its points, its name and its role.',
    },
    {
        id: 'analyses',
        label: 'Analyses',
        hint: 'Check each analysis the record reports: its name, contrast, groups and statistics.',
    },
    {
        id: 'entities',
        label: 'Entities',
        hint: 'Check the groups, tasks, scans and other entities the analyses use.',
    },
    {
        id: 'leftovers',
        label: 'Leftovers',
        hint: 'Tables and entities no analysis uses: keep, link, merge or delete each.',
    },
    {
        id: 'relationships',
        label: 'Relationships',
        hint: 'Which entities each analysis uses: a click links or unlinks, and Accept confirms a row’s links.',
    },
    { id: 'submit', label: 'Submit', hint: 'See what changed and what is left, then submit the review.' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
