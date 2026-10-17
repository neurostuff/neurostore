import { AddAnalysisChooser } from '../coordinates/AddAnalysisChooser';
import { Inspector } from '../inspector/FocusedCard';
import { useShown, useView } from '../store/context';
import { guidedCards } from '../model/guided';
import { LeftoverActions } from './Leftovers';
import { LinkedFrom } from './LinkedFrom';
import { RelationshipAudit } from './RelationshipAudit';
import { StepCards } from './StepCards';

export function AnalysesStep() {
    const cards = useShown((index) => guidedCards(index).analyses);
    return <StepCards label="analyses" cards={cards} />;
}

export function EntitiesStep() {
    const cards = useShown((index) => guidedCards(index).entities);
    return <StepCards label="entities" cards={cards} detail={LinkedFrom} />;
}

export function LeftoversStep() {
    const cards = useShown((index) => guidedCards(index).leftovers);
    return <StepCards label="leftovers" cards={cards} detail={LeftoverActions} />;
}

/** The inspector pane of the step the review is on. */
export function StepInspector() {
    const step = useView((s) => s.step);
    switch (step) {
        case 'analyses':
            return <AnalysesStep />;
        case 'entities':
            return <EntitiesStep />;
        case 'leftovers':
            return <LeftoversStep />;
        case 'relationships':
            return <RelationshipAudit />;
        case 'coordinates':
            return (
                <>
                    <AddAnalysisChooser />
                    <Inspector />
                </>
            );
        default:
            return <Inspector />;
    }
}
