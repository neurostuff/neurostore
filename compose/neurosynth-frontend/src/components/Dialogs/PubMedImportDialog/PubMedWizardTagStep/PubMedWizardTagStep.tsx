import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';

interface IPubMedWizardTagStep {
    ids: string[];
}

const PubMedWizardTagStep: React.FC<IPubMedWizardTagStep> = (props) => {
    return <div>{JSON.stringify(props.ids)}</div>;
};

export default PubMedWizardTagStep;
