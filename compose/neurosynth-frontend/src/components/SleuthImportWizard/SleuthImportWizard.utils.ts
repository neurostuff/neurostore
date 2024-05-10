/* eslint-disable @typescript-eslint/no-unused-vars */
import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { selectBestBaseStudyVersion } from 'components/Dialogs/MoveToExtractionDialog/MovetoExtractionDialog.helpers';
import { ITag } from 'hooks/projects/useGetProjects';
import {
    AnalysisRequest,
    BaseStudy,
    BaseStudyReturn,
    StudyRequest,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { defaultIdentificationSources } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { DefaultSpaceTypes } from 'pages/Studies/StudyStore.helpers';
import API from 'utils/api';
import { v4 as uuidv4 } from 'uuid';

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

export const extractYearFromString = (s: string): { isValid: boolean; value: number } => {
    const match = s.match(/\d{4}/);
    const year = match?.[0];
    if (!year) {
        return { isValid: false, value: 0 };
    }
    return stringToNumber(year);
};

export const extractAuthorsFromString = (s: string): string => {
    const splitStr = s.replaceAll(/[0-9]/g, '');
    return splitStr.trim();
};

export const stringToNumber = (s: string): { value: number; isValid: boolean } => {
    const parsedNum = Number(s);
    if (isNaN(parsedNum)) {
        return {
            value: 0,
            isValid: false,
        };
    }
    return {
        value: parsedNum,
        isValid: true,
    };
};

// [x, y, z]
export const parseCoordinate = (coordinates: string): { coords: number[]; isValid: boolean } => {
    const parsedCoordinates: number[] = [];
    const coordinatesAsStringArr = coordinates.split(/\t/);
    for (const coordinateString of coordinatesAsStringArr) {
        const { value, isValid } = stringToNumber(coordinateString);
        if (!isValid) return { coords: [], isValid: false };
        parsedCoordinates.push(value);
    }
    return {
        coords: parsedCoordinates,
        isValid: true,
    };
};

export const stringsAreValidFileFormat = (
    sleuthStudy: string
): { isValid: boolean; errorMessage?: string } => {
    let containsDOI = false;
    let containsPMID = false;
    let containsAtLeastOneExperimentName = false;
    const parsedSleuthStudy = sleuthStudy.replaceAll(/\/\/\s*/g, '').split('\n');
    let hasReachedCoordinates = false;
    for (let line of parsedSleuthStudy) {
        if (hasReachedCoordinates) {
            if (!parseCoordinate(line).isValid) {
                return {
                    isValid: false,
                    errorMessage: `Invalid coordinates: ${line}`,
                };
            }
        } else {
            if (line.toLocaleLowerCase().includes('subjects')) {
                const [_, numSubjects] = line.split('=');
                const { isValid } = stringToNumber(numSubjects);
                if (!isValid) {
                    return {
                        isValid: false,
                        errorMessage: `Expected number of subjects. Encountered error at: ${line}`,
                    };
                }
                hasReachedCoordinates = true; // we assume that subjects is last before coordinates
            } else if (line.toLocaleLowerCase().includes('doi')) {
                const [_, id] = line.split('=');
                if (!id) {
                    return {
                        isValid: false,
                        errorMessage: `Expected valid DOI but did not find one. Encountered error at: ${line}`,
                    };
                }
                if (containsDOI) {
                    return {
                        isValid: false,
                        errorMessage: `Encountered multiple DOIs: ${line}`,
                    };
                } else {
                    containsDOI = true;
                }
            } else if (line.toLocaleLowerCase().includes('pubmedid')) {
                const [_, id] = line.split('=');
                if (!id) {
                    return {
                        isValid: false,
                        errorMessage: `Expected valid PMID but did not find one. Encountered error at: ${line}`,
                    };
                }
                if (containsPMID) {
                    return {
                        isValid: false,
                        errorMessage: `Encountered multiple PubMed IDs: ${line}`,
                    };
                } else {
                    containsPMID = true;
                }
            } else {
                const [authorInfo, experimentName] = line.split(':');
                if (!experimentName?.trim()) {
                    return {
                        isValid: false,
                        errorMessage: `Invalid experiment name. (Hint: Did you use a semi colon instead of a colon?) Encountered error at: ${line}`,
                    };
                }

                if (!authorInfo?.trim()) {
                    return {
                        isValid: false,
                        errorMessage: `Unexpected format. Encountered error at: ${line}`,
                    };
                }
                containsAtLeastOneExperimentName = true;
            }
        }
    }

    // need at least one identifier
    if (!containsDOI && !containsPMID) {
        return {
            isValid: false,
            errorMessage: `Either DOI or PMID is required. Encountered error at: ${sleuthStudy.slice(
                0,
                100
            )}...`,
        };
    }
    if (!containsAtLeastOneExperimentName) {
        return {
            isValid: false,
            errorMessage: `At least one experiment name is required. Encountered error at: ${sleuthStudy.slice(
                0,
                100
            )}...`,
        };
    }

    return { isValid: true };
};

export const validateFileContents = (
    fileContents: string
): { isValid: boolean; errorMessage?: string } => {
    // we expect the first line to be something like: "// Reference"
    let [expectedReferenceString, ...lines] = fileContents.split(/\r?\n/);
    if (!expectedReferenceString || lines.length === 0) {
        return {
            isValid: false,
            errorMessage: 'File has no data',
        };
    }
    if (!expectedReferenceString.toLocaleLowerCase().includes('reference')) {
        return {
            isValid: false,
            errorMessage: 'File does not have a reference',
        };
    }
    const space = expectedReferenceString.split('=')[1].trim();
    if (!space) {
        return {
            isValid: false,
            errorMessage: 'File does not have a reference',
        };
    }

    const splitLinesBySleuthStudy = fileContents
        .replace(expectedReferenceString + '\n', '')
        .trim()
        .split(/\n\s*\n/);
    for (const sleuthStudy of splitLinesBySleuthStudy) {
        const { isValid, errorMessage = '' } = stringsAreValidFileFormat(sleuthStudy);
        if (!isValid) {
            return {
                isValid: false,
                errorMessage:
                    errorMessage ||
                    `Unexpected format. Encountered error at: ${sleuthStudy.slice(0, 80)}...`,
            };
        }
    }
    return {
        isValid: true,
        errorMessage: undefined,
    };
};

const extractStubFromSleuthStudy = (sleuthStudy: string): ISleuthStub => {
    const studyStrings = sleuthStudy.split('\n');
    const stub: ISleuthStub = studyStrings.reduce(
        (acc, curr) => {
            if (curr.toLocaleLowerCase().includes('subjects')) {
                const [_, numSubjects] = curr.split('=');
                acc.subjects = stringToNumber(numSubjects).value;
            } else if (curr.toLocaleLowerCase().includes('doi')) {
                const [_, doi] = curr.split('=');
                acc.doi = doi;
            } else if (curr.toLocaleLowerCase().includes('pubmedid')) {
                const [_, pmid] = curr.split('=');
                acc.pmid = pmid;
            } else if (/^(-?\d*(\.\d+)?\t?){3}$/.test(curr)) {
                /**
                 * regex is scary but dont panic.
                 * (-?\d*(\.\d+)?\t){2} = match negative sign, 0 or more numbers, optional decimal with numbers, and end with tab. Match three times
                 * do not end regex with "g". We only want the first instance
                 */

                // we know this is valid already so no need to handle invalid case
                const { coords } = parseCoordinate(curr);
                acc.coordinates.push({ x: coords[0], y: coords[1], z: coords[2] });
            } else {
                // We expect <AUTHOR> : <EXPERIMENT_NAME>
                const [authorInfo, experimentName] = curr.split(':');
                acc.authorYearString = authorInfo.trim();
                acc.analysisName = experimentName.trim();
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

export const sleuthUploadToStubs = (
    sleuthFile: string
): Omit<ISleuthFileUploadStubs, 'fileName'> => {
    const [expectedReferenceString, ...lines] = sleuthFile
        .replaceAll(/\/\/\s*/g, '')
        .split(/\r?\n/);

    const sleuthStubs = lines
        .join('\n')
        .trim()
        .split(/\n\s*\n/)
        .map((sleuthStudy) => extractStubFromSleuthStudy(sleuthStudy));

    return {
        space: expectedReferenceString.split('=')[1].trim(),
        sleuthStubs,
    };
};

export const parseFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (file.type !== 'text/plain') {
            return reject(new Error('File should be .txt'));
        }

        const fileReader = new FileReader();
        fileReader.readAsText(file, 'UTF-8');
        fileReader.onload = (e) => {
            const fileContents = e.target?.result;
            if (!fileContents || typeof fileContents !== 'string') {
                return reject(new Error('File contents are invalid (expected string)'));
            }
            const { isValid, errorMessage } = validateFileContents(fileContents);
            return isValid
                ? resolve(fileContents)
                : reject(new Error(errorMessage || 'File is invalid'));
        };

        fileReader.onerror = (err) => {
            reject(err);
        };
        fileReader.onabort = (err) => {
            reject(err);
        };
    });
};

export const sleuthStubsToBaseStudies = (sleuthFiles: ISleuthFileUploadStubs[]) => {
    const allSleuthStubs = sleuthFiles.reduce((acc, curr) => {
        return [...acc, ...curr.sleuthStubs];
    }, [] as ISleuthStub[]);

    const baseStudies: Array<
        Pick<
            BaseStudy,
            'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors'
        >
    > = allSleuthStubs.map((stub) => {
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

/**
 * This function takes each sleuth study and returns either a POST request to create a new study version,
 * or a PUT request to update an existing version. This is because a new version may have been created already
 * during the baseStudiesPost (ingestion) call.
 *
 * If multiple sleuth studies refer to the same study, then we will combine them into a single study with multiple analyses.
 */
export const createUpdateRequestForEachSleuthStudy = (
    returnedBaseStudies: BaseStudyReturn[],
    sleuthUpload: ISleuthFileUploadStubs,
    currUser: string
) => {
    const baseStudyMap = new Map<
        string,
        { studyId: string; data: StudyRequest; request: 'UPDATE' | 'CREATE' }
    >();
    const allSleuthStudies = sleuthUpload.sleuthStubs.map((sleuthStub) => ({
        ...sleuthStub,
        space: sleuthUpload.space,
        fileName: sleuthUpload.fileName,
    }));

    allSleuthStudies.forEach((sleuthStudy) => {
        // step 1: validate that we have either a valid DOI or a valid PMID
        // validate that we have a corresponding base study
        const sleuthStudyDOI = sleuthStudy.doi;
        const sleuthStudyPMID = sleuthStudy.pmid;
        if (!sleuthStudyDOI && !sleuthStudyPMID) throw new Error('No doi or pmid for sleuth study');
        const sleuthStudyIdentifier = sleuthStudyDOI ? sleuthStudyDOI : (sleuthStudyPMID as string);

        const correspondingBaseStudy = returnedBaseStudies.find(
            (baseStudy) => baseStudy.doi === sleuthStudyDOI || baseStudy.pmid === sleuthStudyPMID
        );
        if (!correspondingBaseStudy) {
            throw new Error(
                `No corresponding base study found for sleuth study: PMID: ${sleuthStudyPMID}, DOI: ${sleuthStudyDOI}`
            );
        }
        if (correspondingBaseStudy.versions?.length === 0)
            throw new Error('No versions found for base study');

        // step 2: create the correct request type based on whether the user owns the study version or not
        const request = { studyId: '', data: {}, request: 'CREATE' as 'CREATE' | 'UPDATE' };
        const userCreatedVersion = ((correspondingBaseStudy.versions as StudyReturn[]) || []).find(
            (version) => version.user === currUser
        );
        if (userCreatedVersion && userCreatedVersion.id) {
            request.studyId = userCreatedVersion.id;
            request.request = 'UPDATE';
        } else {
            request.studyId = selectBestBaseStudyVersion(
                correspondingBaseStudy.versions as StudyReturn[]
            ).id!;
            request.request = 'CREATE';
        }

        // step 3: formulate the correct data for the request body.
        // this is where we add multiple analyses if there are multiple sleuth studies connected to the same study
        const space = sleuthStudy.space.toLocaleLowerCase();
        const newAnalysis: AnalysisRequest = {
            id: undefined,
            name: sleuthStudy.analysisName,
            points: sleuthStudy.coordinates.map(({ x, y, z }) => ({
                id: undefined,
                x,
                y,
                z,
                values: [], // this is necessary for the POST request
                space:
                    space === DefaultSpaceTypes.MNI.label
                        ? DefaultSpaceTypes.MNI.value
                        : space === DefaultSpaceTypes.TAL.label
                        ? DefaultSpaceTypes.TAL.value
                        : sleuthStudy.space,
            })),
        };

        if (baseStudyMap.has(sleuthStudyIdentifier)) {
            const existingRequest = baseStudyMap.get(sleuthStudyIdentifier)!;
            (existingRequest.data.analyses as AnalysisRequest[])!.push(newAnalysis);
        } else {
            baseStudyMap.set(sleuthStudyIdentifier, {
                ...request,
                data: {
                    analyses: [newAnalysis],
                },
            });
        }
    });

    return Array.from(baseStudyMap).map(([_key, value]) => value);
};

export const executeHTTPRequestsAsBatches = async (
    requestList: {
        studyId: string;
        data: StudyRequest;
        request: 'UPDATE' | 'CREATE';
    }[],
    // called after every batch has been executed
    callbackFunc?: (progress: number) => void
) => {
    const arrayOfRequestArrays = [];
    for (let i = 0; i < requestList.length; i += 5) {
        arrayOfRequestArrays.push(requestList.slice(i, i + 5));
    }

    const batchedResList = [];
    for (const requests of arrayOfRequestArrays) {
        /**
         * I have to do the mapping from object to HTTP request here because
         * the promises are not lazy. The HTTP requests are launched as soon as
         * the function is called regardless of whether a .then() is added
         */
        const batchedRes = await Promise.all(
            requests.map((request) => {
                return request.request === 'CREATE'
                    ? API.NeurostoreServices.StudiesService.studiesPost(
                          undefined,
                          request.studyId,
                          request.data
                      )
                    : API.NeurostoreServices.StudiesService.studiesIdPut(
                          request.studyId,
                          request.data
                      );
            })
        );
        batchedResList.push(...batchedRes);
        if (callbackFunc) {
            callbackFunc(Math.round((batchedResList.length / requestList.length) * 100));
        }
    }
    return batchedResList;
};

export const sleuthIngestedStudiesToStubs = (
    ingestedSleuthStudyResponses: {
        responses: AxiosResponse<StudyReturn>[];
        fileName: string;
    }[]
) => {
    const stubs: ICurationStubStudy[] = [];

    for (const sleuthResponses of ingestedSleuthStudyResponses) {
        const tag: ITag = {
            label: sleuthResponses.fileName,
            id: uuidv4(),
            isExclusionTag: false,
            isAssignable: true,
        };

        const responsesToStubs: ICurationStubStudy[] = sleuthResponses.responses.map(
            (response) => ({
                id: uuidv4(),
                title: response.data.name || '',
                authors: response.data.authors || '',
                keywords: '',
                pmid: response.data.pmid || '',
                pmcid: response.data.pmcid || '',
                doi: response.data.doi || '',
                articleYear: response.data.year?.toString() || '',
                journal: response.data.publication || '',
                abstractText: response.data.description || '',
                articleLink: '',
                exclusionTag: null,
                identificationSource: defaultIdentificationSources.sleuth,
                tags: [tag],
                neurostoreId: response.data.id,
                searchTerm: '',
            })
        );

        stubs.push(...responsesToStubs);
    }

    return stubs;
};
