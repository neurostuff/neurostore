export interface ISleuthStudy {
    id: string;
    name: string;
    authors: string;
    reference: string;
    numSubjects: string;
    contrast: string;
    coordinates: {
        x: number;
        y: number;
        z: number;
    }[];
}
