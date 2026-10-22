export const STEPS = [
    {
        id: 'coordinates',
        label: 'Coordinates',
        hint: 'Check each coordinate analysis: its points, its name and its role. Shift+J and Shift+K move between analyses, j and k between points; drag over rows or press Space to select points.',
    },
    {
        id: 'analyses',
        label: 'Analyses',
        hint: 'Check each analysis the record reports: first what is compared (j and k move through its signs, + greater and − less), then its other fields; accept it from its head (Shift+A), with its fields that have evidence.',
    },
    {
        id: 'entities',
        label: 'Entities',
        hint: 'Check the groups, tasks, scans and other entities the analyses use; Shift+A accepts a card.',
    },
    {
        id: 'leftovers',
        label: 'Leftovers',
        hint: 'Tables and entities no analysis uses: keep, link, merge or delete each.',
    },
    {
        id: 'relationships',
        label: 'Relationships',
        hint: 'Which entities each analysis uses: accept or reject each link (j and k move between them), remove one, or link another.',
    },
    { id: 'submit', label: 'Submit', hint: 'See what changed and what is left, then submit the review.' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
