import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import { EPropertyType } from 'components/EditMetadata';

const SelectAnalysesComponent: React.FC<{
    annotationId: string;
    selectedValue: IAnalysesSelection;
    onSelectValue: (value: IAnalysesSelection) => void;
    algorithm: IAlgorithmSelection;
}> = (props) => {
    return (
        <div data-testid="select-analyses-component">
            <h6>SelectAnalysesComponent</h6>
            <button
                data-testid="trigger-select-analyses-component-select"
                onClick={() =>
                    props.onSelectValue({
                        selectionValue: '',
                        selectionKey: 'test-key',
                        type: EPropertyType.STRING,
                        referenceDataset: 'reference-dataset',
                    })
                }
            ></button>
        </div>
    );
};

export default SelectAnalysesComponent;
