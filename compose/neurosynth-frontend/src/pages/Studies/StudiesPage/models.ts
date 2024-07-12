export enum SortBy {
    RELEVANCE = 'relevance',
    TITLE = 'name',
    AUTHORS = 'authors',
    DESCRIPTION = 'description',
    CREATEDAT = 'created_at',
    SOURCE = 'source',
    JOURNAL = 'publication',
    LASTUPDATED = 'last_updated',
}

export const SortByEnumToString = {
    [SortBy.RELEVANCE]: 'Relevance',
    [SortBy.TITLE]: 'Name',
    [SortBy.AUTHORS]: 'Authors',
    [SortBy.DESCRIPTION]: 'Description',
    [SortBy.CREATEDAT]: 'Created At',
    [SortBy.SOURCE]: 'Source',
    [SortBy.JOURNAL]: 'Journal',
    [SortBy.LASTUPDATED]: 'Last Updated',
};

export enum Source {
    NEUROSTORE = 'neurostore',
    NEUROVAULT = 'neurovault',
    PUBMED = 'pubmed',
    NEUROSYNTH = 'neurosynth',
    NEUROQUERY = 'neuroquery',
    ALL = 'all',
}
export enum SearchBy {
    ALL = 'all fields',
    TITLE = 'title',
    DESCRIPTION = 'description',
    AUTHORS = 'authors',
    JOURNAL = 'journal',
}

export enum SearchDataType {
    COORDINATE = 'coordinate',
    IMAGE = 'image',
    ALL = 'all',
}

export const SearchDataTypeEnumToString = {
    [SearchDataType.COORDINATE]: 'Coordinates',
    [SearchDataType.ALL]: 'All',
    [SearchDataType.IMAGE]: 'Images',
};

export const SearchByMapping = {
    [SearchBy.ALL]: 'genericSearchStr',
    [SearchBy.AUTHORS]: 'authorSearch',
    [SearchBy.DESCRIPTION]: 'descriptionSearch',
    [SearchBy.TITLE]: 'nameSearch',
    [SearchBy.JOURNAL]: 'journalSearch',
};

export class SearchCriteria {
    constructor(
        public genericSearchStr: string | undefined = undefined,
        public sortBy: SortBy | undefined = undefined,
        public pageOfResults: number = 1,
        public descOrder: boolean = true,
        public pageSize: number = 10,
        public isNested: boolean | undefined = undefined,
        public nameSearch: string | undefined = undefined,
        public descriptionSearch: string | undefined = undefined,
        public authorSearch: string | undefined = undefined,
        public showUnique: boolean | undefined = undefined,
        public source: Source | undefined = undefined,
        public journalSearch: string | undefined = undefined,
        public userId: string | undefined = undefined,
        public dataType: SearchDataType | undefined = SearchDataType.ALL,
        public studysetOwner: string | undefined = undefined,
        public level: 'group' | 'meta' | undefined = undefined,
        public pmid: string | undefined = undefined,
        public doi: string | undefined = undefined,
        public flat: boolean | undefined = true,
        public info: boolean | undefined = true
    ) {}
}
