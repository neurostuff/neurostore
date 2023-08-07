import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { IExtractionMetadata } from 'interfaces/project/extraction.interface';
import { ICurationMetadata } from 'interfaces/project/curation.interface';
import { IMetaAnalysisMetadata } from 'interfaces/project/metaAnalysis.interface';

export interface IProvenance {
    curationMetadata: ICurationMetadata;
    extractionMetadata: IExtractionMetadata;
    metaAnalysisMetadata: IMetaAnalysisMetadata;
}

// define this interface to overwrite provenance type
export interface INeurosynthProject extends Omit<Project, 'provenance'> {
    provenance: IProvenance;
}

// define this interface to overwrite provenance type
export interface INeurosynthProjectReturn extends Omit<ProjectReturn, 'provenance'> {
    provenance: IProvenance;
}
