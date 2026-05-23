import type { MouseEvent } from 'react';

const INTERACTIVE_ANALYSIS_CELL_SELECTOR =
    'button, [role="button"], input, textarea, select, [role="menuitem"], [role="dialog"], .MuiModal-root, .MuiPopover-root';

/** TableCell toggles row expansion on click; ignore bubbled portal/menu/dialog interactions. */
export const shouldToggleStudyAnalysisRowExpansion = (event: Pick<MouseEvent, 'target'>): boolean => {
    const target = event.target;
    if (!(target instanceof Element)) return true;
    return !target.closest(INTERACTIVE_ANALYSIS_CELL_SELECTOR);
};
