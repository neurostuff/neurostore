export enum SearchBy {
    ALL = 'all fields',
    TITLE = 'title',
    DESCRIPTION = 'description',
    AUTHORS = 'authors',
    JOURNAL = 'journal',
}

export const SearchByMapping = {
    [SearchBy.ALL]: 'genericSearchStr',
    [SearchBy.AUTHORS]: 'authorSearch',
    [SearchBy.DESCRIPTION]: 'descriptionSearch',
    [SearchBy.TITLE]: 'nameSearch',
    [SearchBy.JOURNAL]: 'journalSearch',
};
