import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetPubmedIDs from 'hooks/requests/useGetPubMedIds';
import React from 'react';
import PubMedWizardTagStep, {
    IPubMedWizardTagStep,
} from './PubMedWizardTagStep/PubMedWizardTagStep';

const PubmedWizardTagStepContainer: React.FC<IPubMedWizardTagStep> = (props) => {
    const results = useGetPubmedIDs(props.ids || []);

    const isLoading = results.some((x) => x.isLoading);
    const isError = results.some((x) => x.isError);
    const queryResults = results.map((x) => x.data || []);

    return (
        <>
            {/* this component logic needs to be separated from the useGetPubmedIds hook, otherwise the useEffect causes an infinite loop as the results object changes every render */}
            <PubMedWizardTagStep
                {...props}
                queryResults={queryResults}
                isLoading={isLoading}
                isError={isError}
            />
        </>
    );
};

export default PubmedWizardTagStepContainer;
