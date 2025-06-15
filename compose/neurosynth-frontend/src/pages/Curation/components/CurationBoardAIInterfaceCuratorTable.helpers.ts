import { ColumnFiltersState, SortingState } from '@tanstack/react-table';

export const saveCurationTableState = (
    projectId: string | undefined,
    state: ICurationTableState,
    uniqueKey?: string
) => {
    if (!projectId) return;
    window.localStorage.setItem(
        `${projectId}-${uniqueKey ? `${uniqueKey}-` : ''}curation-table`,
        JSON.stringify(state)
    );
};

export const updateCurationTableState = (
    projectId: string | undefined,
    updateOrUpdatorFn: Partial<ICurationTableState> | ((state: ICurationTableState) => ICurationTableState),
    uniqueKey?: string
) => {
    if (!projectId) return;

    const curationTableState = retrieveCurationTableState(projectId, uniqueKey);
    if (!curationTableState) return;
    if (typeof updateOrUpdatorFn === 'function') {
        const newState = updateOrUpdatorFn(curationTableState);
        saveCurationTableState(projectId, newState, uniqueKey);
    } else {
        const newState = { ...curationTableState, ...updateOrUpdatorFn };
        saveCurationTableState(projectId, newState, uniqueKey);
    }
};

export const retrieveCurationTableState = (
    projectId: string | undefined,
    uniqueKey?: string
): ICurationTableState | null => {
    if (!projectId) return null;
    try {
        const parsedState = JSON.parse(
            window.localStorage.getItem(`${projectId}-${uniqueKey ? `${uniqueKey}-` : ''}curation-table`) || '{}'
        );

        if (!parsedState.columnFilters || !parsedState.sorting || !parsedState.selectedColumns) {
            return {
                firstTimeSeeingPage: true,
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
    firstTimeSeeingPage: boolean; // flag to set sensible default
    selectedColumns: string[];
    columnFilters: ColumnFiltersState;
    sorting: SortingState;
}
