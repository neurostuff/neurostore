import { EDefaultPRISMAStepNames } from 'components/ProjectComponents/EditMetaAnalyses/CurationStep/CurationStep';
import { ICurationColumn } from 'interfaces/project/curation.interface';
import { useProjectCurationIsPrisma } from 'stores/ProjectStore';
import CurationGenericInterface from './CurationGenericInterface';
import CurationPRISMAIdentificationInterface from './CurationPRISMAIdentificationInterface';

const CurationContainer: React.FC<{ selectedColumn: ICurationColumn }> = (props) => {
    const isPRISMA = useProjectCurationIsPrisma();

    if (isPRISMA && props.selectedColumn?.name === EDefaultPRISMAStepNames.IDENTIFICATION) {
        return <CurationPRISMAIdentificationInterface />;
    }

    return <CurationGenericInterface />;
};

export default CurationContainer;
