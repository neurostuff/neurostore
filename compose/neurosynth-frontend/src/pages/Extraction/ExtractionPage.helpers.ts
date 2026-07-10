import { StudyReturn } from 'neurostore-typescript-sdk';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

// returns bool representing whether or not there is a difference between the curation included studies and what is currently in the studyset
export const hasDifferenceBetweenStudysetAndCuration = (
    curationStubs: ICurationStubStudy[],
    studysetStudies: StudyReturn[]
): boolean => {
    const curationSet = new Set();
    curationStubs.forEach((curationStub) => {
        if (curationStub.title) curationSet.add((curationStub.title ?? '').toLocaleLowerCase());
        if (curationStub.pmid) curationSet.add(curationStub.pmid.toLocaleLowerCase());
        if (curationStub.doi) curationSet.add(curationStub.doi.toLocaleLowerCase());
    });

    const studysetSet = new Set();
    studysetStudies.forEach((studysetStudy) => {
        if (studysetStudy.name) studysetSet.add((studysetStudy.name ?? '').toLocaleLowerCase());
        if (studysetStudy.pmid) studysetSet.add(studysetStudy.pmid.toLocaleLowerCase());
        if (studysetStudy.doi) studysetSet.add(studysetStudy.doi.toLocaleLowerCase());
    });

    const stubInCurationButNotInStudyset = curationStubs.some((stub) => {
        const hasMatch =
            (stub.title && studysetSet.has(stub.title.toLocaleLowerCase())) ||
            (stub.pmid && studysetSet.has(stub.pmid.toLocaleLowerCase())) ||
            (stub.doi && studysetSet.has(stub.doi.toLocaleLowerCase()));
        return !hasMatch;
    });

    const studyInStudysetButNotInCuration = studysetStudies.some((study) => {
        const hasMatch =
            (study.name && curationSet.has(study.name.toLocaleLowerCase())) ||
            (study.pmid && curationSet.has(study.pmid.toLocaleLowerCase())) ||
            (study.doi && curationSet.has(study.doi.toLocaleLowerCase()));
        return !hasMatch;
    });

    return stubInCurationButNotInStudyset || studyInStudysetButNotInCuration;
};
