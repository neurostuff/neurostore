import type { AnalysisReturn, BaseStudyList, BaseStudyReturn, StudyReturn } from 'neurostore-typescript-sdk';

export type StudyReturnNested = Omit<StudyReturn, 'analyses'> & {
    analyses?: AnalysisReturn[];
};

export type StudyReturnNonNested = Omit<StudyReturn, 'analyses'> & {
    analyses?: string[];
};

export type StudyReturnFlat = Omit<StudyReturn, 'analyses'>;

export type BaseStudyReturnFlat = Omit<BaseStudyReturn, 'versions'>;

export type BaseStudyReturnNested = Omit<BaseStudyReturn, 'versions'> & {
    versions?: StudyReturnNested[];
};

export type BaseStudyReturnNonNested = Omit<BaseStudyReturn, 'versions'> & {
    versions?: string[];
};

export type BaseStudyReturnInfo = Omit<BaseStudyReturn, 'versions'> & {
    versions?: Pick<StudyReturn, 'id' | 'user' | 'username' | 'created_at' | 'updated_at' | 'source'>[];
};

export type BaseStudyListOf<T extends BaseStudyReturn = BaseStudyReturn> = Omit<BaseStudyList, 'results'> & {
    results?: T[];
};

export type BaseStudyListFlat = BaseStudyListOf<BaseStudyReturnFlat>;
export type BaseStudyListNested = BaseStudyListOf<BaseStudyReturnNested>;
export type BaseStudyListNonNested = BaseStudyListOf<BaseStudyReturnNonNested>;
export type BaseStudyListInfo = BaseStudyListOf<BaseStudyReturnInfo>;
