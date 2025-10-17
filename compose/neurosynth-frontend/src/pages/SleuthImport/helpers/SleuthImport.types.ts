export const PUBMED_API_KEY = import.meta.env.VITE_APP_PUBMED_API_KEY as string;

export interface ISleuthStub {
    doi?: string;
    pmid?: string;
    authorYearString: string;
    analysisName: string;
    subjects: number;
    coordinates: { x: number; y: number; z: number }[];
}

export interface ISleuthFileUploadStubs {
    fileName: string;
    space: string;
    sleuthStubs: ISleuthStub[];
}
