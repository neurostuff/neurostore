import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';

const SelectAnalysesComponent = (props: {
    annotationId: string;
    selectedValue: IAnalysesSelection;
    onSelectValue: (value: IAnalysesSelection) => void;
    algorithm: IAlgorithmSelection;
}) => {
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
