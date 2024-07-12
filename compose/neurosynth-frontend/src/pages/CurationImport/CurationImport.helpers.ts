import { ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.types';
import { IResolveProjectDuplicatesCurationStubStudy } from 'pages/CurationImport/CurationImport.types';

import { ICurationColumn, ICurationStubStudy } from 'pages/Curation/Curation.types';

export const flattenColumns = (
    cols: ICurationColumn[]
): IResolveProjectDuplicatesCurationStubStudy[] => {
    const allStubsInProject: IResolveProjectDuplicatesCurationStubStudy[] = (cols || []).reduce(
        (acc, curr, currIndex) => {
            const convertedStudies = curr.stubStudies.map((study, studyIndex) => {
                const resolutionStr: 'duplicate' | 'not-duplicate' | 'resolved' | undefined =
                    study.exclusionTag
                        ? study.exclusionTag.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                            ? 'duplicate'
                            : 'resolved'
                        : undefined;

                return {
                    ...study,
                    columnIndex: currIndex,
                    studyIndex: studyIndex,
                    colName: curr.name,
                    resolution: resolutionStr,
                };
            });

            acc.push(...convertedStudies);

            return acc;
        },
        [] as IResolveProjectDuplicatesCurationStubStudy[] // we need to typecast as typescript infers this type as never[]
    );

    return allStubsInProject;
};

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
