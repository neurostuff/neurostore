import { Box } from '@mui/material';
import NavigationButtons, { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { IDynamicValueType } from 'pages/MetaAnalysis/components/DynamicForm.types';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useState } from 'react';
import SelectSpecificationComponent from 'pages/MetaAnalysis/components/MetaAnalysisSelectSpecificationComponent';
import { IAlgorithmSelection } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import useStudiesWithMissingSampleSizeALE from '../hooks/useALEMissingSampleSize';
import { isALE } from './MetaAnalysisDynamicForm';

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
    const studiesMissingSampleSize = useStudiesWithMissingSampleSizeALE(algorithmSpec.estimator?.label);

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

    const isUsingSampleSize =
        isALE(algorithmSpec.estimator?.label ?? '') &&
        !algorithmSpec.estimatorArgs?.['kernel__fwhm'] &&
        !algorithmSpec.estimatorArgs?.['kernel__sample_size'];

    const nextButtonDisabled =
        !algorithmSpec.estimator?.label || (isUsingSampleSize && studiesMissingSampleSize.length > 0);

    return (
        <Box>
            <SelectSpecificationComponent
                algorithm={algorithmSpec}
                onSelectSpecification={(update) => setAlgorithmSpec(update)}
            />
            <Box sx={{ marginTop: '1rem' }}>
                <NavigationButtons
                    nextButtonDisabled={nextButtonDisabled}
                    nextButtonStyle="contained"
                    onButtonClick={handleNavigate}
                    prevButtonDisabled
                />
            </Box>
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationAlgorithmStep;
