import { Inspector } from '../inspector/FocusedCard';
import { useReviewStore } from '../store/context';
import type { ReviewState } from '../store/reviewStore';
import { guidedCards } from './guided';
import { LeftoverActions } from './Leftovers';
import { LinkedFrom } from './LinkedFrom';
import { RelationshipAudit } from './RelationshipAudit';
import { StepCards } from './StepCards';

const cardsOf = (s: ReviewState) => guidedCards(s.index);

export function AnalysesStep() {
    const cards = useReviewStore((s) => cardsOf(s).analyses);
    return <StepCards label="analyses" cards={cards} />;
}

export function EntitiesStep() {
    const cards = useReviewStore((s) => cardsOf(s).entities);
    return <StepCards label="entities" cards={cards} detail={LinkedFrom} />;
}

export function LeftoversStep() {
    const cards = useReviewStore((s) => cardsOf(s).leftovers);
    return <StepCards label="leftovers" cards={cards} detail={LeftoverActions} />;
}

/** The inspector pane of the step the review is on. */
export function StepInspector() {
    const step = useReviewStore((s) => s.step);
    switch (step) {
        case 'analyses':
            return <AnalysesStep />;
        case 'entities':
            return <EntitiesStep />;
        case 'leftovers':
            return <LeftoversStep />;
        case 'relationships':
            return <RelationshipAudit />;
        default:
            return <Inspector />;
    }
}
