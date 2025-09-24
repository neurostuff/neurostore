import { stringToNumber } from 'helpers/utils';
import {
    cleanLine,
    extractAuthorsFromString,
    extractYearFromString,
    isCoordLine,
    ISleuthFileUploadStubs,
    ISleuthStub,
    parseCoordinate,
    parseKeyVal,
} from '.';
import { v4 as uuidv4 } from 'uuid';
import { ITag } from 'hooks/projects/useGetProjects';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { defaultIdentificationSources } from 'pages/Project/store/ProjectStore.types';
import { BaseStudy } from 'neurostore-typescript-sdk';

const extractStubFromSleuthStudy = (sleuthStudy: string): ISleuthStub => {
    const studyStrings = sleuthStudy.split('\n');
    const stub: ISleuthStub = studyStrings.reduce(
        (acc, curr) => {
            const kv = parseKeyVal(curr);

            if (kv?.key === 'subjects') {
                const { value } = stringToNumber(kv.value);
                acc.subjects = value;
                return acc;
            } else if (kv?.key === 'doi') {
                acc.doi = kv.value;
                return acc;
            } else if (kv?.key === 'pubmedid') {
                acc.pmid = kv.value;
                return acc;
            } else if (isCoordLine(curr)) {
                const { coords } = parseCoordinate(curr);
                acc.coordinates.push({ x: coords[0], y: coords[1], z: coords[2] });
                return acc;
            } else {
                // We expect <AUTHOR> : <EXPERIMENT_NAME>, allow extra colons and leading comments
                const header = cleanLine(curr);
                if (!header) return acc;
                const [authorInfo, ...experimentName] = header.split(':');
                acc.authorYearString = authorInfo.trim();
                const exp = experimentName.join(':').trim();
                acc.analysisName = acc.analysisName ? `${acc.analysisName}, ${exp}` : exp;
            }
            return acc;
        },
        {
            analysisName: '',
            authorYearString: '',
            subjects: 0,
            doi: '',
            pmid: '',
            coordinates: [],
        } as ISleuthStub
    );
    return stub;
};

export const sleuthUploadToStubs = (sleuthFile: string): Omit<ISleuthFileUploadStubs, 'fileName'> => {
    // this is safe as we have already normalized the line endings
    const lines = sleuthFile.split('\n');
    // find first meaningful line for Reference
    let idx = 0;
    while (idx < lines.length && !cleanLine(lines[idx])) idx++;
    const refKV = parseKeyVal(lines[idx] || '');
    const space = refKV?.key === 'reference' ? refKV.value : '';

    const sleuthStubs = lines
        .slice(idx + 1)
        .join('\n')
        .trim()
        .split(/\n\s*\n/)
        .map((sleuthStudy) => extractStubFromSleuthStudy(sleuthStudy));

    return { space, sleuthStubs };
};

export const sleuthIngestedStudiesToStubs = (
    uploads: {
        fileName: string;
        studyAnalysisList: { studyId: string; analysisId: string; doi: string; pmid: string }[];
        baseStudySleuthstubsWithDetails: BaseStudy[];
    }[]
) => {
    // although we know that each individual upload is deduplicates,
    // its possible that there are multiple uploads with the same study. We want to deduplicate
    // studies across all uploads so we
    const allIdentifiersSet = new Set<string>();
    const studyResponsesToStubs: ICurationStubStudy[] = [];

    for (const { fileName, studyAnalysisList, baseStudySleuthstubsWithDetails } of uploads) {
        const tag: ITag = {
            label: fileName,
            id: uuidv4(),
            isExclusionTag: false,
            isAssignable: true,
        };

        baseStudySleuthstubsWithDetails.forEach(
            ({ name, authors, pmid, pmcid, doi, year, publication, description }) => {
                if ((pmid && allIdentifiersSet.has(pmid)) || (doi && allIdentifiersSet.has(doi))) {
                    return;
                }

                if (pmid) allIdentifiersSet.add(pmid);
                if (doi) allIdentifiersSet.add(doi);

                const correspondingStudyId = studyAnalysisList.find(
                    (studyAnalysisObject) => studyAnalysisObject.doi === doi || studyAnalysisObject.pmid === pmid
                );

                studyResponsesToStubs.push({
                    id: uuidv4(),
                    title: name || '',
                    authors: authors || '',
                    keywords: '',
                    pmid: pmid || '',
                    pmcid: pmcid || '',
                    doi: doi || '',
                    articleYear: year?.toString() || '',
                    journal: publication || '',
                    abstractText: description || '',
                    articleLink: '',
                    exclusionTag: null,
                    identificationSource: defaultIdentificationSources.sleuth,
                    tags: [tag],
                    neurostoreId: correspondingStudyId?.studyId || '',
                });
            }
        );
    }
    return studyResponsesToStubs;
};

export const sleuthStubsToBaseStudies = (sleuthStubs: ISleuthStub[]) => {
    const baseStudies: Array<
        Pick<BaseStudy, 'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors'>
    > = sleuthStubs.map((stub) => {
        const { isValid, value } = extractYearFromString(stub.authorYearString);
        return {
            name: '',
            doi: stub.doi || '',
            pmid: stub.pmid || '',
            pmcid: '',
            year: isValid ? value : undefined,
            description: '',
            publication: '',
            authors: extractAuthorsFromString(stub.authorYearString),
        };
    });
    return baseStudies;
};
