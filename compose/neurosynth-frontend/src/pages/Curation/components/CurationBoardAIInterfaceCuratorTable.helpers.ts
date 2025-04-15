import { ColumnFiltersState, SortingState } from '@tanstack/react-table';

export const saveCurationTableState = (projectId: string | undefined, state: ICurationTableState) => {
    if (!projectId) return;
    window.sessionStorage.setItem(`${projectId}-curation-table`, JSON.stringify(state));
};

export const updateCurationTableState = (
    projectId: string | undefined,
    updateOrUpdatorFn: Partial<ICurationTableState> | ((state: ICurationTableState) => ICurationTableState)
) => {
    if (!projectId) return;

    const curationTableState = retrieveCurationTableState(projectId);
    if (!curationTableState) return;
    if (typeof updateOrUpdatorFn === 'function') {
        const newState = updateOrUpdatorFn(curationTableState);
        saveCurationTableState(projectId, newState);
    } else {
        const newState = { ...curationTableState, ...updateOrUpdatorFn };
        saveCurationTableState(projectId, newState);
    }
};

export const retrieveCurationTableState = (projectId: string | undefined): ICurationTableState | null => {
    if (!projectId) return null;
    try {
        const parsedState = JSON.parse(window.sessionStorage.getItem(`${projectId}-curation-table`) || '{}');

        if (!parsedState.columnFilters || !parsedState.sorting || !parsedState.selectedColumns) {
            return {
                selectedColumns: [],
                columnFilters: [],
                sorting: [],
            };
        } else {
            return parsedState;
        }
    } catch (e) {
        return null;
    }
};

export interface ICurationTableState {
    selectedColumns: string[];
    columnFilters: ColumnFiltersState;
    sorting: SortingState;
}
