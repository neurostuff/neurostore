import { Annotation, MetaAnalysisReturn, Specification, Studyset, Tag } from 'neurosynth-compose-typescript-sdk';

type MetaAnalysisRelationshipKeys = 'specification' | 'neurostore_studyset' | 'neurostore_annotation' | 'tags';

export type MetaAnalysisReturnNonNested = Omit<MetaAnalysisReturn, MetaAnalysisRelationshipKeys> & {
    specification?: string;
    neurostore_studyset?: string;
    neurostore_annotation?: string;
    tags?: Array<string>;
};

export type MetaAnalysisReturnNested = Omit<MetaAnalysisReturn, MetaAnalysisRelationshipKeys> & {
    specification?: Specification;
    neurostore_studyset?: Studyset;
    neurostore_annotation?: Annotation;
    tags?: Array<Tag>;
};
