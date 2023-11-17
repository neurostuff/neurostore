import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

export type IMultiGroupOption = IAutocompleteObject & {
    type: string;
    id: string;
};

export const DEFAULT_REFERENCE_DATASETS: IMultiGroupOption[] = [
    { label: 'Neurostore Dataset', description: '', type: 'Reference Dataset', id: 'neurostore' },
    { label: 'Neuroquery Dataset', description: '', type: 'Reference Dataset', id: 'neuroquery' },
    { label: 'Neurosynth Dataset', description: '', type: 'Reference Dataset', id: 'neurosynth' },
];
