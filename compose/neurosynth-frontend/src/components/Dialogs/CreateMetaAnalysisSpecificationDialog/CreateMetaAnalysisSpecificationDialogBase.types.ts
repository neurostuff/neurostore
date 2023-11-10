import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

export interface IAnalysesSelection {
    selectionKey: string;
    type: EPropertyType;
    selectionValue?: AnnotationNoteValue;
}

export interface IAlgorithmSelection {
    estimator: IAutocompleteObject | null;
    estimatorArgs: IDynamicValueType;
    corrector: IAutocompleteObject | null;
    correctorArgs: IDynamicValueType;
}
