export const STEPS = [
    { id: 'coordinates', label: 'Coordinates' },
    { id: 'analyses', label: 'Analyses' },
    { id: 'entities', label: 'Entities' },
    { id: 'leftovers', label: 'Leftovers' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'submit', label: 'Submit' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
