import { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

export const saveExtractionTableState = (projectId: string | undefined, state: IExtractionTableState) => {
    if (!projectId) return;
    window.sessionStorage.setItem(`${projectId}-extraction-table`, JSON.stringify(state));
};

export const updateExtractionTableState = (projectId: string | undefined, state: Partial<IExtractionTableState>) => {
    if (!projectId) return;
    const extractionTableState = retrieveExtractionTableState(projectId);
    if (!extractionTableState) return;
    const newState = { ...extractionTableState, ...state };
    saveExtractionTableState(projectId, newState);
};

export const retrieveExtractionTableState = (projectId: string | undefined) => {
    if (!projectId) return null;
    try {
        const parsedState = JSON.parse(
            window.sessionStorage.getItem(`${projectId}-extraction-table`) ?? '{}'
        ) as IExtractionTableState | null;

        if (!parsedState?.columnFilters || !parsedState?.sorting || !parsedState?.studies || !parsedState?.pagination) {
            return {
                columnFilters: [],
                sorting: [],
                studies: [],
                pagination: { pageIndex: 0, pageSize: 25 },
            };
        } else {
            return parsedState;
        }
    } catch {
        return null;
    }
};

export const updateExtractionTableStateStudySwapInStorage = (
    projectId: string | undefined,
    studyId: string,
    newStudyId: string
) => {
    if (!projectId) return;
    const extractionTableState = retrieveExtractionTableState(projectId);
    if (!extractionTableState) return;

    const foundIndex = extractionTableState.studies.findIndex((id) => id === studyId);
    if (foundIndex < 0) return;

    extractionTableState.studies[foundIndex] = newStudyId;

    saveExtractionTableState(projectId, extractionTableState);
};

export interface IExtractionTableState {
    columnFilters: ColumnFiltersState;
    sorting: SortingState;
    studies: string[];
    pagination: PaginationState;
}
