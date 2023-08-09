import { IPRISMAConfig } from 'interfaces/project/curation.interface';

export const indexToPRISMAMapping = (
    index: number
): keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined => {
    switch (index) {
        case 0:
            return 'identification';
        case 1:
            return 'screening';
        case 2:
            return 'eligibility';
        default:
            return undefined;
    }
};
