import { AnalysisReturn, StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';

type StudyReturnWithFullAnalyses = Omit<StudyReturn, 'analyses'> & {
    analyses?: Array<AnalysisReturn>;
};

type AnalysisReturnSummary = {
    id: string;
    point_count: number;
};

export type StudyReturnWithSummaryAnalyses = Omit<StudyReturn, 'analyses'> & {
    analyses?: Array<AnalysisReturnSummary>;
};

export type StudysetReturnNonNested = Omit<StudysetReturn, 'studies'> & {
    studies?: Array<string>;
};

export type StudysetReturnNested = Omit<StudysetReturn, 'studies'> & {
    studies?: Array<StudyReturnWithFullAnalyses>;
};

export type StudysetReturnSummary = Omit<StudysetReturn, 'studies'> & {
    studies?: Array<StudyReturnWithSummaryAnalyses>;
};
