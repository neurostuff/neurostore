import { Box } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useState } from 'react';
import SelectSpecificationComponent from './SelectSpecificationComponent/SelectSpecificationComponent';
import { IAlgorithmSelection } from '../CreateMetaAnalysisSpecificationDialogBase.types';

const CreateMetaAnalysisSpecificationAlgorithmStep: React.FC<{
    onChooseAlgorithm: (
        estimator: IAutocompleteObject,
        estimatorArgs: IDynamicValueType,
        corrector: IAutocompleteObject | null,
        correctorArgs: IDynamicValueType
    ) => void;
    algorithm: IAlgorithmSelection;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const [algorithmSpec, setAlgorithmSpec] = useState<IAlgorithmSelection>(props.algorithm);

    const handleNavigate = (button: ENavigationButton) => {
        if (button === ENavigationButton.NEXT && algorithmSpec.estimator?.label) {
            props.onChooseAlgorithm(
                algorithmSpec.estimator,
                algorithmSpec.estimatorArgs,
                algorithmSpec.corrector,
                algorithmSpec.correctorArgs
            );
        }
        props.onNavigate(button);
    };

    return (
        <Box>
            <SelectSpecificationComponent
                algorithm={algorithmSpec}
                onSelectSpecification={(update) => setAlgorithmSpec(update)}
            />
            <Box sx={{ width: '100$%', marginTop: '1rem' }}>
                <NavigationButtons
                    nextButtonDisabled={!algorithmSpec.estimator}
                    nextButtonStyle="contained"
                    onButtonClick={handleNavigate}
                />
            </Box>
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationAlgorithmStep;
