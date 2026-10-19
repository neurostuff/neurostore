import type { EntityNode } from '../model/record';
import { useShown, useView } from '../store/context';
import { DiffCard } from './DiffCard';
import { EntityCard, InspectorFrame } from './Inspector';

/** The focused entity's card; in two columns, original and review, while the diff is shown. */
export function FocusedCard({
    entity,
    focusedSlot,
    stickyHead,
}: {
    entity: EntityNode;
    focusedSlot?: string;
    /** Whether the card's head stays at the top of the scrolling pane while its fields scroll. */
    stickyHead?: boolean;
}) {
    const diffOn = useView((s) => s.diffOn);
    return diffOn ? (
        <DiffCard entity={entity} focusedSlot={focusedSlot} />
    ) : (
        <EntityCard entity={entity} focusedSlot={focusedSlot} stickyHead={stickyHead} />
    );
}

export function Inspector() {
    const focused = useView((s) => s.focus.entity);
    const entity = useShown((index) => index.entity(focused));
    const focusedSlot = useView((s) => s.focus.slot);
    return <InspectorFrame>{entity && <FocusedCard entity={entity} focusedSlot={focusedSlot} />}</InspectorFrame>;
}
