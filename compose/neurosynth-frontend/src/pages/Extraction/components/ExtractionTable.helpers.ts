import { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

export const retrieveExtractionTableState = (projectId: string | undefined) => {
    if (!projectId) return null;
    try {
        const parsedState = JSON.parse(
            window.sessionStorage.getItem(`${projectId}-extraction-table`) || '{}'
        ) as IExtractionTableState | null;

        if (!parsedState?.columnFilters || !parsedState?.pagination || !parsedState?.sorting || !parsedState?.studies) {
            return null;
        } else {
            return parsedState;
        }
    } catch (e) {
        return null;
    }
};

export const updateExtractionTableStateInStorage = (
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

    window.sessionStorage.setItem(
        `${projectId}-extraction-table`,
        JSON.stringify(extractionTableState)
    );
};

export interface IExtractionTableState {
    columnFilters: ColumnFiltersState;
    pagination: PaginationState;
    sorting: SortingState;
    studies: string[];
}

export const getAuthorShortName = (authors: string) => {
    let shortName = authors;
    const authorsList = (authors || '').split(',');
    if (authorsList.length > 1) {
        shortName = `${authorsList[0]}., et al.`;
    }
    return shortName;
};
