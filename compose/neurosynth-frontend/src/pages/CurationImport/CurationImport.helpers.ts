import { defaultExclusionTags } from 'pages/Project/store/ProjectStore.types';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

// a study is defined as a duplicate if it has either a matching PMID, DOI, or title.
// We must account for the case where a study has a missing PMID, DOI, or title as well.

export const createDuplicateMap = <T extends ICurationStubStudy>(stubs: T[]) => {
    const map = new Map<string, T[]>();
    const duplicatesList: T[][] = [];

    stubs.forEach((stub) => {
        const formattedTitle = stub.title.toLocaleLowerCase().trim();
        if (stub.doi && map.has(stub.doi)) {
            const duplicatedStubs = map.get(stub.doi);
            duplicatedStubs!.push(stub);
        } else if (stub.pmid && map.has(stub.pmid)) {
            const duplicatedStubs = map.get(stub.pmid);
            duplicatedStubs!.push(stub);
        } else if (stub.title && map.has(formattedTitle)) {
            // in the future, this title search can be replaced with a fuzzier search via a string comparison algorithm
            const duplicatedStubs = map.get(formattedTitle);
            duplicatedStubs!.push(stub);
        } else {
            const newDuplicatedStubsList: T[] = [];
            newDuplicatedStubsList.push({ ...stub });
            duplicatesList.push(newDuplicatedStubsList);
            if (stub.doi) map.set(stub.doi, newDuplicatedStubsList);
            if (stub.pmid) map.set(stub.pmid, newDuplicatedStubsList);
            if (formattedTitle) map.set(formattedTitle, newDuplicatedStubsList);
        }
    });

    return {
        duplicateMapping: map,
        duplicatesList: duplicatesList,
    };
};

export const hasDuplicates = (stubs: ICurationStubStudy[]): boolean => {
    const { duplicatesList } = createDuplicateMap(stubs);
    return duplicatesList.some((x) => x.length > 1);
};

export const scoreStub = (stub: ICurationStubStudy) => {
    let score = 0;
    const HUGE_SCORE = 100;
    const BIG_SCORE = 10;
    const SCORE = 1;

    if (stub.neurostoreId !== undefined) score = score + HUGE_SCORE; // we always want to prefer neurostore studies
    if (stub.title !== undefined) score = score + BIG_SCORE;
    if (stub.doi !== undefined) score = score + BIG_SCORE;
    if (stub.pmid !== undefined) score = score + BIG_SCORE;

    if (stub.pmcid !== undefined) score = score + SCORE;
    if (stub.authors !== undefined) score = score + SCORE;
    if (stub.journal !== undefined) score = score + SCORE;
    if (stub.keywords !== undefined) score = score + SCORE;
    if (stub.abstractText !== undefined) score = score + SCORE;

    return score;
};

// This function takes a list of stubs, and automatically outputs the same list of stubs with duplicate stubs marked as excluded.
// It will prefer stubs that have more information, and will mark stubs with less information as duplicates.
// It will not modify the original
export const automaticallyResolveDuplicates = (stubs: ICurationStubStudy[]) => {
    const updatedStubs: ICurationStubStudy[] = stubs.map((stub) => ({ ...stub })); // clone list
    const { duplicatesList } = createDuplicateMap(stubs);
    duplicatesList.forEach((duplicates) => {
        if (duplicates.length <= 1) return;

        const orderByRichness = duplicates.sort((a, b) => {
            return scoreStub(b) - scoreStub(a); // biggest first
        });

        // iterate from 2nd stub to nth stub
        for (let i = 1; i < orderByRichness.length; i++) {
            const duplicate = orderByRichness[i];
            const foundStub = updatedStubs.find((x) => x.id === duplicate.id);
            if (!foundStub) return;
            foundStub.exclusionTagId = defaultExclusionTags.duplicate.id;
        }
    });
    return updatedStubs;
};
