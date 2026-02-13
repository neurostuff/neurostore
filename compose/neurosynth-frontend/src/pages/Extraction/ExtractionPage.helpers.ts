import { StudyReturn, StudysetReturnRelationshipsStudies } from 'neurostore-typescript-sdk';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

// returns bool representing whether or not there is a difference between the curation included studies and what is currently in the studyset
export const hasDifferenceBetweenStudysetAndCuration = (
    curationStubs: ICurationStubStudy[],
    studysetStudies: StudyReturn[]
): boolean => {
    const studysetSet = new Set();
    studysetStudies.forEach((studysetStudy) => {
        if (studysetStudy.name) studysetSet.add((studysetStudy.name ?? '').toLocaleLowerCase());
        if (studysetStudy.pmid) studysetSet.add(studysetStudy.pmid);
        if (studysetStudy.doi) studysetSet.add(studysetStudy.doi);
    });

    return curationStubs.some(
        (stub) => !studysetSet.has(stub.title) && !studysetSet.has(stub.pmid) && !studysetSet.has(stub.doi)
    );
};
