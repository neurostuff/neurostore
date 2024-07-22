import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';
import { IDynamicValueType } from 'pages/MetaAnalysis/components/DynamicForm.types';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

export interface IAnalysesSelection {
    selectionKey: string | undefined;
    type: EPropertyType | undefined;
    selectionValue: AnnotationNoteValue | undefined; // defined if type is not a boolean
    referenceDataset?: string; // defined if multi group analysis is used (i.e. ALESubtraction or MKDAChi2)
}

export interface IAlgorithmSelection {
    estimator: IAutocompleteObject | null;
    estimatorArgs: IDynamicValueType;
    corrector: IAutocompleteObject | null;
    correctorArgs: IDynamicValueType;
}
