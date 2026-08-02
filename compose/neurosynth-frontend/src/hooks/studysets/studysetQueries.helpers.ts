import { StudyReturn } from 'neurostore-typescript-sdk';

export const sortStudysetStudies = (studyset: {
    studies?: Array<string> | Array<StudyReturn>;
}) => {
    studyset.studies?.sort((a, b) => {
        if (typeof a === 'string' && typeof b === 'string') {
            return a.localeCompare(b);
        }

        const studyA = a as StudyReturn;
        const studyB = b as StudyReturn;
        return (studyA.name || '').localeCompare(studyB.name || '');
    });
};
