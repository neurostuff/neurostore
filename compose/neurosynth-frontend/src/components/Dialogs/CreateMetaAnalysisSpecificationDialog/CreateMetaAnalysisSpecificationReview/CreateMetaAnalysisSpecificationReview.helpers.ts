import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import {
    isMultiGroupAlgorithm,
    selectedReferenceDatasetIsDefaultDataset,
} from '../CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent.helpers';
import { IAnalysesSelection } from '../CreateMetaAnalysisSpecificationDialogBase.types';
import { EPropertyType } from 'components/EditMetadata';

export const getWeightAndConditionsForSpecification = (
    estimator: IAutocompleteObject | null | undefined,
    selection: IAnalysesSelection
): {
    weights: number[];
    conditions: string[] | boolean[];
    databaseStudyset: string | undefined;
} => {
    if (!estimator) return { weights: [], conditions: [], databaseStudyset: undefined };

    const isMultiGroup = isMultiGroupAlgorithm(estimator);
    const usingPredefinedDataset = selectedReferenceDatasetIsDefaultDataset(
        selection.referenceDataset
    );
    let conditions: string[] | boolean[] = [];
    let weights = [];
    let databaseStudyset: string | undefined;

    if (isMultiGroup && usingPredefinedDataset) {
        // 1 for our dataset, -1 for the dataset we are comparing with
        // for predefined reference datasets (i.e. neuroquery, neurostore, neurosynth) we do not include that here
        weights = [1];
        conditions = [selection.selectionValue] as string[] | boolean[];
        databaseStudyset = selection.referenceDataset;
    } else if (isMultiGroup) {
        if (!selection.referenceDataset) {
            throw new Error('no reference dataset');
        }

        weights = [1, -1];
        conditions = [selection.selectionValue, selection.referenceDataset] as string[] | boolean[];
    } else {
        weights = [1];
        conditions = [selection.selectionValue] as string[] | boolean[];
    }

    // parse condition into correct type
    conditions.forEach((condition, index) => {
        switch (selection.type) {
            case EPropertyType.BOOLEAN:
                conditions[index] =
                    typeof condition === 'boolean' ? condition : condition === 'true';
                break;
            case EPropertyType.STRING:
                conditions[index] = condition.toString();
                break;
            default:
                throw new Error('unsupported selection type');
        }
    });

    return {
        weights,
        conditions,
        databaseStudyset,
    };
};
