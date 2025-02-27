/* eslint-disable @typescript-eslint/no-unused-vars */
import { AxiosError, AxiosResponse } from 'axios';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { selectBestBaseStudyVersion } from 'helpers/Extraction.helpers';
import { stringToNumber } from 'helpers/utils';
import { IESearchResult } from 'hooks/external/useGetPubMedIdFromDOI';
import { INeurosynthParsedPubmedArticle } from 'hooks/external/useGetPubMedIds';
import { ICurationMetadata, IProvenance, ITag } from 'hooks/projects/useGetProjects';
import {
    AnalysisRequest,
    AnalysisReturn,
    BaseStudiesPost200Response,
    BaseStudiesPostRequest,
    BaseStudy,
    BaseStudyReturn,
    NoteCollectionReturn,
    StudyRequest,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { generateNewProjectData, initCurationHelper } from 'pages/Project/store/ProjectStore.helpers';
import { defaultIdentificationSources } from 'pages/Project/store/ProjectStore.types';
import { DefaultSpaceTypes, IStudyVersion } from 'pages/Study/store/StudyStore.helpers';
import { MutateOptions } from 'react-query';
import API from 'utils/api';
import { v4 as uuidv4 } from 'uuid';

const PUBMED_API_KEY = import.meta.env.VITE_APP_PUBMED_API_KEY as string;

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

export const stringsAreValidFileFormat = (sleuthStudy: string): { isValid: boolean; errorMessage?: string } => {
    let containsDOI = false;
    let containsPMID = false;
    let containsAtLeastOneExperimentName = false;
    const parsedSleuthStudy = sleuthStudy.replaceAll(/\/\/\s*/g, '').split('\n');
    let hasReachedCoordinates = false;
    for (const line of parsedSleuthStudy) {
        if (hasReachedCoordinates) {
            if (!parseCoordinate(line).isValid) {
                return {
                    isValid: false,
                    errorMessage: `Invalid coordinates: ${line}`,
                };
            }
        } else {
            if (line.toLocaleLowerCase().includes('subjects=')) {
                const [_, numSubjects] = line.split('=');
                const { isValid } = stringToNumber(numSubjects);
                if (!isValid) {
                    return {
                        isValid: false,
                        errorMessage: `Expected number of subjects. Encountered error at: ${line}`,
                    };
                }
                hasReachedCoordinates = true; // we assume that subjects is last before coordinates
            } else if (line.toLocaleLowerCase().includes('doi=')) {
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
            } else if (line.toLocaleLowerCase().includes('pubmedid=')) {
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
                        errorMessage: `Unexpected format. (Hint: Did you omit a colon or use a semi colon instead of a colon?) Encountered error at: ${line}`,
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
            errorMessage: `Either DOI or PMID is required. (Hint: is it in the right format?) Encountered error at: ${sleuthStudy.slice(
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

export const validateFileContents = (fileContents: string): { isValid: boolean; errorMessage?: string } => {
    // we expect the first line to be something like: "// Reference"
    const [expectedReferenceString, ...lines] = fileContents.split(/\r?\n/);
    if (!expectedReferenceString || lines.length === 0) {
        return {
            isValid: false,
            errorMessage: 'File has no data',
        };
    }
    if (!expectedReferenceString.toLocaleLowerCase().includes('reference')) {
        return {
            isValid: false,
            errorMessage: 'No coordinate reference space specified (e.g. expecting REFERENCE property)',
        };
    }
    const space = expectedReferenceString.split('=')[1].trim();
    if (!space) {
        return {
            isValid: false,
            errorMessage: 'No coordinate reference space specified (e.g. expecting REFERENCE property)',
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
                errorMessage: errorMessage || `Unexpected format. Encountered error at: ${sleuthStudy.slice(0, 80)}...`,
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
            if (curr.toLocaleLowerCase().includes('subjects=')) {
                const [_, numSubjects] = curr.split('=');
                acc.subjects = stringToNumber(numSubjects).value;
            } else if (curr.toLocaleLowerCase().includes('doi=')) {
                const [_, doi] = curr.split('=');
                acc.doi = doi;
            } else if (curr.toLocaleLowerCase().includes('pubmedid=')) {
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
                // However, we need to prepare for something like <AUTHOR> : <SOME TEXT> : <MORE TEXT> where "<SOME TEXT> : <MORE TEXT>" is the experiment name
                const [authorInfo, ...experimentName] = curr.split(':');
                acc.authorYearString = authorInfo.trim();
                acc.analysisName = acc.analysisName
                    ? `${acc.analysisName}, ${experimentName.join('').trim()}`
                    : experimentName.join('').trim();
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
    const [expectedReferenceString, ...lines] = sleuthFile.replaceAll(/\/\/\s*/g, '').split(/\r?\n/);

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
            return isValid ? resolve(fileContents) : reject(new Error(errorMessage || 'File is invalid'));
        };

        fileReader.onerror = (err) => {
            reject(err);
        };
        fileReader.onabort = (err) => {
            reject(err);
        };
    });
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

/**
 * This function takes each sleuth study and returns either a POST request to create a study with analyses, or a POST request to create an
 * analysis
 *
 * If multiple sleuth studies refer to the same study, and the new study is being newly created, then this would be one HTTP request.
 * If multiple sleuth studies refer to the same study, and a version is already owner by the current user, then this would be multiple HTTP requests
 */
export const organizeSleuthStubsIntoHTTPRequests = (
    ingestedBaseStudies: BaseStudyReturn[],
    sleuthUpload: ISleuthFileUploadStubs,
    currUserId: string
) => {
    const studyRequestsMap = new Map<string, { studyId: string; analyses: AnalysisRequest[] }>();

    const allRequests: (() => Promise<AxiosResponse<StudyRequest | AnalysisRequest>>)[] = [];
    sleuthUpload.sleuthStubs.forEach(({ doi, pmid, analysisName, subjects, coordinates }) => {
        // step 1: validate that we have either a valid DOI or a valid PMID
        // validate that we have a corresponding base study
        if (!doi && !pmid) throw new Error('No doi or pmid for sleuth study');
        const sleuthStudyIdentifier = doi ? doi : (pmid as string);

        const correspondingBaseStudy = ingestedBaseStudies.find(
            (ingestedBaseStudy) => ingestedBaseStudy.doi === doi || ingestedBaseStudy.pmid === pmid
        );
        if (!correspondingBaseStudy) {
            throw new Error(`No corresponding base study found for sleuth study: PMID: ${pmid}, DOI: ${doi}`);
        }
        if (correspondingBaseStudy.versions?.length === 0)
            throw new Error(`No versions found for base study: ${correspondingBaseStudy.id}`);

        // step 2: formulate the analysis request for the given sleuth stub
        // each sleuth stub is essentially an analysis
        const space = sleuthUpload.space.toLocaleLowerCase();
        const newAnalysis: AnalysisRequest = {
            id: undefined,
            name: analysisName,
            metadata: {
                subjects: subjects,
            },
            conditions: [],
            points: coordinates.map(({ x, y, z }, index) => ({
                id: undefined,
                analysis: undefined,
                order: index,
                x,
                y,
                z,
                values: [], // this is necessary for the POST request
                space:
                    space === DefaultSpaceTypes.MNI.label.toLocaleLowerCase()
                        ? DefaultSpaceTypes.MNI.value
                        : space === DefaultSpaceTypes.TAL.label.toLocaleLowerCase()
                          ? DefaultSpaceTypes.TAL.value
                          : space,
            })),
        };

        // step 3: if the user does not own the study version, then we need to create a new study with a new analysis, or new analyses.
        // There may be other sleuth stubs in the future that belongs to the same study, so we dont create the request yet. Instead, we add all STUDY POST requests to a list
        const loggedInUsersExistingStudyVersion = ((correspondingBaseStudy.versions as IStudyVersion[]) || []).find(
            (version) => version.user === currUserId
        );
        if (loggedInUsersExistingStudyVersion && loggedInUsersExistingStudyVersion.id) {
            // if there is a duplicate, then this analyses POST request will just return the existing analysis. If not, it will create the analysis and return that instead
            allRequests.push(() =>
                API.NeurostoreServices.AnalysesService.analysesPost({
                    ...newAnalysis,
                    study: loggedInUsersExistingStudyVersion.id,
                })
            );
        } else {
            if (studyRequestsMap.has(sleuthStudyIdentifier)) {
                const existingStudyCreateRequest = studyRequestsMap.get(sleuthStudyIdentifier);
                existingStudyCreateRequest!.analyses.push(newAnalysis);
            } else {
                studyRequestsMap.set(sleuthStudyIdentifier, {
                    studyId: selectBestBaseStudyVersion((correspondingBaseStudy?.versions as IStudyVersion[]) || [])
                        .id as string,
                    analyses: [newAnalysis],
                });
            }
        }
    });

    allRequests.push(
        ...Array.from(studyRequestsMap).map(
            ([_, value]) =>
                () =>
                    API.NeurostoreServices.StudiesService.studiesPost(undefined, value.studyId, {
                        analyses: value.analyses.map((analysis, index) => ({
                            ...analysis,
                            study: undefined,
                            order: index + 1,
                        })),
                    })
        )
    );
    return allRequests;
};

export const executeHTTPRequestsAsBatches = async <T, Y>(
    requestList: T[],
    mapFunc: (request: T) => Promise<Y>,
    rateLimit: number,
    delayInMS?: number,
    progressCallbackFunc?: (progress: number) => void
) => {
    const arrayOfRequestArrays = [];
    for (let i = 0; i < requestList.length; i += rateLimit) {
        arrayOfRequestArrays.push(requestList.slice(i, i + rateLimit));
    }

    const batchedResList: Y[] = [];
    for (const requests of arrayOfRequestArrays) {
        /**
         * I have to do the mapping from object to HTTP request here because
         * the promises are not lazy. The HTTP requests are launched as soon as
         * the function is called regardless of whether a .then() is added
         */
        const batchedRes = await Promise.all(requests.map(mapFunc));
        batchedResList.push(...batchedRes);
        if (progressCallbackFunc) {
            progressCallbackFunc(Math.round((batchedResList.length / requestList.length) * 100));
        }
        if (delayInMS) {
            await new Promise((res) => {
                setTimeout(() => {
                    res(null);
                }, delayInMS);
            });
        }
    }
    return batchedResList;
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

export const updateUploadSummary = (sleuthUpload: ISleuthFileUploadStubs) => {
    const numCoordinatesImported = sleuthUpload.sleuthStubs.reduce((acc, curr) => {
        return acc + curr.coordinates.length;
    }, 0);

    return {
        numAnalyses: sleuthUpload.sleuthStubs.length,
        numCoordinates: numCoordinatesImported,
    };
};

// sleuth import wizard build helpers

export const lookForPMIDsAndFetchStudyDetails = async (
    baseStudySleuthStubs: BaseStudy[],
    getPubmedIdFromDOICallback: (doi: string) => Promise<AxiosResponse<IESearchResult>>,
    updateProgressStateCallback: (value: number) => void,
    getPubmedStudiesFromIdsCallback: (pubmedIds: string[]) => Promise<INeurosynthParsedPubmedArticle[][]>
) => {
    const responses = await executeHTTPRequestsAsBatches(
        baseStudySleuthStubs,
        (baseStudy) => {
            if (baseStudy.pmid) {
                // fake a response if we already have a PMID
                return new Promise<AxiosResponse<IESearchResult>>((res) => {
                    const fakeAxiosResponse: AxiosResponse = {
                        data: {
                            esearchresult: {
                                count: '1',
                                idlist: [baseStudy.pmid],
                            },
                        },
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                        config: {},
                    };
                    res(fakeAxiosResponse);
                });
            } else {
                // we know that if a study does not have a PMID, then it must at least have a DOI because
                // we have already validated this when the files were uploaded
                return getPubmedIdFromDOICallback(baseStudy.doi as string);
            }
        },
        PUBMED_API_KEY ? 10 : 3,
        1200,
        updateProgressStateCallback
    );

    const pubmedIds: string[] = [];
    responses.forEach((response) => {
        const searchResult = response.data.esearchresult;
        if (searchResult.count === '1' && searchResult.idlist.length === 1 && !searchResult.errorlist) {
            pubmedIds.push(searchResult.idlist[0]);
        }
    });
    return (await getPubmedStudiesFromIdsCallback(pubmedIds)).flat();
};

export const applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates = (
    baseStudySleuthStubs: BaseStudy[],
    pubmedStudies: INeurosynthParsedPubmedArticle[]
) => {
    const idToPubmedStudyMap = new Map<string, INeurosynthParsedPubmedArticle>();
    pubmedStudies.forEach((pubmedStudy) => {
        if (pubmedStudy.PMID) idToPubmedStudyMap.set(pubmedStudy.PMID, pubmedStudy);
        if (pubmedStudy.DOI) idToPubmedStudyMap.set(pubmedStudy.DOI, pubmedStudy);
    });

    const deduplicatedBaseStudiesWithDetails: BaseStudy[] = [];
    baseStudySleuthStubs.forEach((baseStudy) => {
        const associatedPubmedStudy =
            idToPubmedStudyMap.get(baseStudy.pmid || '') || idToPubmedStudyMap.get(baseStudy.doi || '');

        let updatedBaseStudyWithDetails: BaseStudy = {};
        if (!associatedPubmedStudy) {
            // there is no corresponding pubmed study
            updatedBaseStudyWithDetails = { ...baseStudy };
        } else {
            const authorString = (associatedPubmedStudy?.authors || []).reduce(
                (prev, curr, index, arr) =>
                    `${prev}${curr.ForeName} ${curr.LastName}${index === arr.length - 1 ? '' : ', '}`,
                ''
            );
            const { isValid, value } = stringToNumber(associatedPubmedStudy?.articleYear || '');

            updatedBaseStudyWithDetails = {
                authors: baseStudy.authors ? baseStudy.authors : authorString,
                description: associatedPubmedStudy.abstractText,
                doi: baseStudy.doi ? baseStudy.doi : associatedPubmedStudy.DOI,
                pmcid: baseStudy.pmcid ? baseStudy.pmcid : associatedPubmedStudy.PMCID,
                name: baseStudy.name ? baseStudy.name : associatedPubmedStudy.title,
                pmid: baseStudy.pmid ? baseStudy.pmid : associatedPubmedStudy.PMID,
                publication: baseStudy.publication ? baseStudy.publication : associatedPubmedStudy.journal.title,
                year: baseStudy.year ? baseStudy.year : isValid ? value : undefined,
                level: 'group',
            };
        }

        const hasThisStudyAlready = deduplicatedBaseStudiesWithDetails.some(
            ({ doi, pmid }) =>
                (doi && doi === updatedBaseStudyWithDetails.doi) || (pmid && pmid === updatedBaseStudyWithDetails.pmid)
        );
        if (!hasThisStudyAlready) deduplicatedBaseStudiesWithDetails.push(updatedBaseStudyWithDetails);
    });
    return deduplicatedBaseStudiesWithDetails;
};

export const ingestBaseStudies = async (
    baseStudiesWithPubmedDetailsNoDuplicates: BaseStudy[],
    sleuthUpload: ISleuthFileUploadStubs,
    userId: string,
    ingestCallback: (
        variables: BaseStudiesPostRequest,
        options?:
            | MutateOptions<AxiosResponse<BaseStudiesPost200Response>, AxiosError<any>, BaseStudiesPostRequest, unknown>
            | undefined
    ) => Promise<AxiosResponse<BaseStudiesPost200Response>>,
    updateProgressStateCallback: (value: number) => void
) => {
    const { data } = await ingestCallback(baseStudiesWithPubmedDetailsNoDuplicates);

    // consolidate sleuth stubs into studies and create update requests
    const httpRequests = organizeSleuthStubsIntoHTTPRequests(data as BaseStudyReturn[], sleuthUpload, userId);

    const httpResponses = await executeHTTPRequestsAsBatches(
        httpRequests,
        (requestFunc) => requestFunc(),
        5,
        undefined,
        updateProgressStateCallback
    );

    const studyToAnalysisObjects: {
        studyId: string;
        analysisId: string;
        doi: string;
        pmid: string;
    }[] = [];
    httpResponses.forEach((httpResponse) => {
        if ((httpResponse.data as StudyReturn).base_study) {
            // this is a study
            ((httpResponse.data as StudyReturn).analyses || []).forEach((analysis) => {
                studyToAnalysisObjects.push({
                    studyId: httpResponse.data.id as string,
                    analysisId: (analysis as AnalysisReturn)?.id as string,
                    doi: (httpResponse.data as StudyReturn).doi || '',
                    pmid: (httpResponse.data as StudyReturn).pmid || '',
                });
            });
        } else {
            const studyId = (httpResponse.data as AnalysisReturn)?.study as string;
            const correspondingBaseStudy = (data as BaseStudyReturn[]).find((baseStudy) => {
                return ((baseStudy as BaseStudyReturn).versions || []).some(
                    (baseStudyVersion) => (baseStudyVersion as IStudyVersion)?.id === studyId
                );
            });
            // this is an analysis
            studyToAnalysisObjects.push({
                studyId: (httpResponse.data as AnalysisReturn)?.study as string,
                analysisId: httpResponse.data.id as string,
                doi: correspondingBaseStudy?.doi || '',
                pmid: correspondingBaseStudy?.pmid || '',
            });
        }
    });
    return studyToAnalysisObjects;
};

export const generateAnnotationForSleuthImport = (
    studyAnalysisObjects: { studyId: string; analysisId: string }[],
    sleuthFilename: string
) => {
    // Later on, the library HandsOnTable will be used to render the annotaiton in a spreadsheet like UI.
    // We want to use the filename as a key, but we cannot include periods due to this issue:
    // https://github.com/handsontable/handsontable/issues/5439
    //
    // As a result, we should remove the period from the filename
    const filenameReplacePeriodsWithUnderscores = sleuthFilename.replaceAll('.', '_');

    // We want to use the filename as an inclusion column
    const noteKeys: { [key: string]: EPropertyType } = {
        included: EPropertyType.BOOLEAN,
        [filenameReplacePeriodsWithUnderscores]: EPropertyType.BOOLEAN,
    };

    const responsesToNotes: NoteCollectionReturn[] = studyAnalysisObjects.map(({ analysisId, studyId }) => ({
        analysis: analysisId,
        study: studyId,
        note: {
            included: true,
            [filenameReplacePeriodsWithUnderscores]: true,
        },
    }));

    return {
        noteKeys: noteKeys,
        notes: responsesToNotes,
    };
};

export const createProjectHelper = async (
    studysetId: string,
    annotationId: string,
    uploads: {
        fileName: string;
        studyAnalysisList: { studyId: string; analysisId: string; doi: string; pmid: string }[];
        baseStudySleuthstubsWithDetails: BaseStudy[];
    }[],
    createProjectCallback: (
        variables: Project,
        options?: MutateOptions<AxiosResponse<ProjectReturn>, AxiosError<any>, Project, unknown> | undefined
    ) => Promise<AxiosResponse<ProjectReturn>>
) => {
    const fileNames = uploads.reduce((acc, curr, index) => {
        return index === 0 ? `${curr.fileName}` : `${acc}, ${curr.fileName}`;
    }, '');

    const newProjectData = generateNewProjectData(
        'Untitled sleuth project',
        `New project generated from files: ${fileNames}`
    );

    const curationMetadata: ICurationMetadata = initCurationHelper(['not included', 'included'], false);

    curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies = sleuthIngestedStudiesToStubs(uploads);

    const setStudyStatusesAsComplete = uploads
        .reduce((acc, curr) => {
            return [...acc, ...curr.studyAnalysisList.map((x) => x.studyId as string)];
        }, [] as string[])
        .map((x) => ({
            id: x,
            status: EExtractionStatus.COMPLETED,
        }));

    return createProjectCallback({
        ...newProjectData,
        provenance: {
            ...newProjectData.provenance,
            curationMetadata: curationMetadata,
            extractionMetadata: {
                studyStatusList: setStudyStatusesAsComplete,
                annotationId: annotationId,
                studysetId: studysetId,
            },
            metaAnalysisMetadata: {
                canEditMetaAnalyses: true,
            },
        } as IProvenance,
    });
};
