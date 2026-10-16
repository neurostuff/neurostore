import { coordinatePanelFor } from '../coordinates/actions';
import { panelFor } from './actions';
import type { ReviewStores } from '../store/context';
import type { PanelKind } from '../store/viewStore';

/** Opens the panel `kind` on the focused coordinate analysis or record item; nothing where it does not apply. */
export function openPanelOn(stores: ReviewStores, kind: PanelKind) {
    const session = stores.session.getState();
    const view = stores.view.getState();
    const panel = view.coordinates ? coordinatePanelFor(session, view, kind) : panelFor(session, view.focus, kind);
    if (panel) view.openPanel(panel);
}
