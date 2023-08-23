export enum SortBy {
    TITLE = 'name',
    AUTHORS = 'authors',
    DESCRIPTION = 'description',
    CREATEDAT = 'created_at',
    SOURCE = 'source',
    PUBLICATION = 'publication',
}

export enum Source {
    NEUROSTORE = 'neurostore',
    NEUROVAULT = 'neurovault',
    PUBMED = 'pubmed',
    NEUROSYNTH = 'neurosynth',
    NEUROQUERY = 'neuroquery',
    ALL = 'all_sources',
}
export enum SearchBy {
    TITLE = 'title',
    DESCRIPTION = 'description',
    AUTHORS = 'authors',
    ALL = 'all fields',
}

export enum SearchDataType {
    COORDINATE = 'coordinate',
    IMAGE = 'image',
    ALL = 'all',
}

export const SearchByMapping = {
    [SearchBy.ALL]: 'genericSearchStr',
    [SearchBy.AUTHORS]: 'authorSearch',
    [SearchBy.DESCRIPTION]: 'descriptionSearch',
    [SearchBy.TITLE]: 'nameSearch',
};

export class SearchCriteria {
    constructor(
        public genericSearchStr: string | undefined = undefined,
        public sortBy: SortBy = SortBy.TITLE,
        public pageOfResults: number = 1,
        public descOrder: boolean = true,
        public pageSize: number = 10,
        public isNested: boolean = false,
        public nameSearch: string | undefined = undefined,
        public descriptionSearch: string | undefined = undefined,
        public authorSearch: string | undefined = undefined,
        public showUnique: boolean = true,
        public source: Source | undefined = undefined,
        public userId: string | undefined = undefined,
        public dataType: SearchDataType = SearchDataType.ALL,
        public studysetOwner: string | undefined = undefined,
        public level: 'group' | 'meta' | undefined = undefined,
        public pmid: string | undefined = undefined,
        public doi: string | undefined = undefined,
        public flat: 'true' | 'false' | undefined = 'true'
    ) {}
}
