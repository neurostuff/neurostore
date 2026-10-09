import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { ICurationMetadata } from 'pages/Curation/Curation.types';
import { IExtractionMetadata } from 'pages/Extraction/Extraction.types';
import { IMetaAnalysisMetadata } from 'pages/MetaAnalysis/MetaAnalysis.types';

// define this interface to overwrite provenance type
export interface INeurosynthProjectReturn extends Omit<ProjectReturn, 'provenance'> {
    provenance: IProvenance;
}

// define this interface to overwrite provenance type
export interface INeurosynthProject extends Omit<Project, 'provenance'> {
    provenance: IProvenance;
}

export enum EAnalysisType {
    CBMA = 'CBMA',
    IBMA = 'IBMA',
}

export interface IProvenance {
    type?: EAnalysisType;
    curationMetadata: ICurationMetadata;
    extractionMetadata: IExtractionMetadata;
    metaAnalysisMetadata: IMetaAnalysisMetadata;
}
