/* eslint-disable @typescript-eslint/no-unused-vars */
import { AxiosError, AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { selectBestBaseStudyVersion } from 'components/Dialogs/MoveToExtractionDialog/MovetoExtractionDialog.helpers';
import { EPropertyType } from 'components/EditMetadata';
import { IESearchResult } from 'hooks/external/useGetPubMedIdFromDOI';
import { INeurosynthParsedPubmedArticle } from 'hooks/external/useGetPubMedIds';
import { ICurationMetadata, IProvenance, ITag } from 'hooks/projects/useGetProjects';
import {
    AnalysisRequest,
    BaseStudiesPost200Response,
    BaseStudiesPostRequest,
    BaseStudy,
    BaseStudyReturn,
    NoteCollectionReturn,
    StudyRequest,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { EExtractionStatus } from 'pages/ExtractionPage/ExtractionPage';
import {
    defaultIdentificationSources,
    generateNewProjectData,
    initCurationHelper,
} from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { DefaultSpaceTypes } from 'pages/Studies/StudyStore.helpers';
import { MutateOptions } from 'react-query';
import API from 'utils/api';
import { v4 as uuidv4 } from 'uuid';

const PUBMED_API_KEY = process.env.REACT_APP_PUBMED_API_KEY as string;

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
            errorMessage:
                'No coordinate reference space specified (e.g. expecting REFERENCE property)',
        };
    }
    const space = expectedReferenceString.split('=')[1].trim();
    if (!space) {
        return {
            isValid: false,
            errorMessage:
                'No coordinate reference space specified (e.g. expecting REFERENCE property)',
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
            if (curr.toLocaleLowerCase().includes('subjects=')) {
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

export const sleuthStubsToBaseStudies = (sleuthStubs: ISleuthStub[]) => {
    const baseStudies: Array<
        Pick<
            BaseStudy,
            'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors'
        >
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
 * This function takes each sleuth study and returns either a POST request string to create a new study version,
 * or a PUT request string to update an existing version.
 * A POST request is made if there is only one study version which does not belong to the current user
 * A PUT request is made if there is a study version that does belong to the current user
 *
 * If multiple sleuth studies refer to the same study, then we will combine them into a single study with multiple analyses.
 *
 * Note: The reason we represent PUT and POST requests as strings is because we dont want the function to execute. Promises are not lazy.
 */
export const consolidateSleuthStubsIntoStudies = (
    baseStudiesInNeurostore: BaseStudyReturn[],
    sleuthUpload: ISleuthFileUploadStubs,
    currUser: string
) => {
    const consolidatedSleuthStubsMap = new Map<
        string,
        { studyId: string; data: StudyRequest; request: 'UPDATE' | 'CREATE' }
    >();
    sleuthUpload.sleuthStubs.forEach((sleuthStub) => {
        // step 1: validate that we have either a valid DOI or a valid PMID
        // validate that we have a corresponding base study
        const sleuthStudyDOI = sleuthStub.doi;
        const sleuthStudyPMID = sleuthStub.pmid;
        if (!sleuthStudyDOI && !sleuthStudyPMID) throw new Error('No doi or pmid for sleuth study');
        const sleuthStudyIdentifier = sleuthStudyDOI ? sleuthStudyDOI : (sleuthStudyPMID as string);

        const correspondingBaseStudy = baseStudiesInNeurostore.find(
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
        const loggedInUsersExistingVersion = (
            (correspondingBaseStudy.versions as StudyReturn[]) || []
        ).find((version) => version.user === currUser);
        if (loggedInUsersExistingVersion && loggedInUsersExistingVersion.id) {
            request.studyId = loggedInUsersExistingVersion.id;
            request.request = 'UPDATE';
        } else {
            request.studyId = selectBestBaseStudyVersion(
                correspondingBaseStudy.versions as StudyReturn[]
            ).id!;
            request.request = 'CREATE';
        }

        // step 3: formulate the correct data for the request body.
        // this is where we add multiple analyses if there are multiple sleuth studies connected to the same study
        const space = sleuthUpload.space.toLocaleLowerCase();
        const newAnalysis: AnalysisRequest = {
            id: undefined,
            name: sleuthStub.analysisName,
            points: sleuthStub.coordinates.map(({ x, y, z }) => ({
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
                        : space,
            })),
        };

        if (consolidatedSleuthStubsMap.has(sleuthStudyIdentifier)) {
            const existingRequest = consolidatedSleuthStubsMap.get(sleuthStudyIdentifier)!;
            (existingRequest.data.analyses as AnalysisRequest[])!.push(newAnalysis);
        } else {
            consolidatedSleuthStubsMap.set(sleuthStudyIdentifier, {
                ...request,
                data: {
                    analyses: [newAnalysis],
                },
            });
        }
    });

    return Array.from(consolidatedSleuthStubsMap).map(([_key, value]) => value);
};

export const executeHTTPRequestsAsBatches = async <T, Y>(
    requestList: T[],
    mapFunc: (request: T) => Promise<AxiosResponse<Y>>,
    rateLimit: number,
    delayInMS?: number,
    callbackFunc?: (progress: number) => void
) => {
    const arrayOfRequestArrays = [];
    for (let i = 0; i < requestList.length; i += rateLimit) {
        arrayOfRequestArrays.push(requestList.slice(i, i + rateLimit));
    }

    const batchedResList = [];
    for (const requests of arrayOfRequestArrays) {
        /**
         * I have to do the mapping from object to HTTP request here because
         * the promises are not lazy. The HTTP requests are launched as soon as
         * the function is called regardless of whether a .then() is added
         */
        const batchedRes = await Promise.all(requests.map(mapFunc));
        batchedResList.push(...batchedRes);
        if (callbackFunc) {
            callbackFunc(Math.round((batchedResList.length / requestList.length) * 100));
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
    uploads: { studies: StudyReturn[]; fileName: string }[]
) => {
    return uploads.reduce((acc, curr) => {
        const tag: ITag = {
            label: curr.fileName,
            id: uuidv4(),
            isExclusionTag: false,
            isAssignable: true,
        };

        const studyResponsesToStubs = curr.studies.map((study) => ({
            id: uuidv4(),
            title: study.name || '',
            authors: study.authors || '',
            keywords: '',
            pmid: study.pmid || '',
            pmcid: study.pmcid || '',
            doi: study.doi || '',
            articleYear: study.year?.toString() || '',
            journal: study.publication || '',
            abstractText: study.description || '',
            articleLink: '',
            exclusionTag: null,
            identificationSource: defaultIdentificationSources.sleuth,
            tags: [tag],
            neurostoreId: study.id,
            searchTerm: '',
        }));
        return [...acc, ...studyResponsesToStubs];
    }, [] as ICurationStubStudy[]);
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
    sleuthStudyUploadBaseStudies: BaseStudy[],
    getPubmedIdFromDOICallback: (doi: string) => Promise<AxiosResponse<IESearchResult>>,
    updateProgressStateCallback: (value: number) => void,
    getPubmedStudiesFromIdsCallback: (
        pubmedIds: string[]
    ) => Promise<INeurosynthParsedPubmedArticle[][]>
) => {
    const responses = await executeHTTPRequestsAsBatches(
        sleuthStudyUploadBaseStudies,
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
                            header: {
                                type: 'NEUROSTORE_MOCK',
                                version: 'NA',
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
                // we have already validated the uploaded files
                return getPubmedIdFromDOICallback(baseStudy.doi as string);
            }
        },
        PUBMED_API_KEY ? 4 : 3,
        1200,
        updateProgressStateCallback
    );

    const pubmedIds: string[] = [];
    responses.forEach((response) => {
        const searchResult = response.data.esearchresult;
        if (
            searchResult.count === '1' &&
            searchResult.idlist.length === 1 &&
            !searchResult.errorlist
        ) {
            pubmedIds.push(searchResult.idlist[0]);
        }
    });
    return (await getPubmedStudiesFromIdsCallback(pubmedIds)).flat();
};

export const applyPubmedStudyDetailsToBaseStudies = (
    originalBaseStudies: BaseStudy[],
    pubmedStudies: INeurosynthParsedPubmedArticle[]
) => {
    const debug: any[] = [];
    const idToPubmedStudyMap = new Map<string, INeurosynthParsedPubmedArticle>();
    pubmedStudies.forEach((pubmedStudy) => {
        if (pubmedStudy.PMID) idToPubmedStudyMap.set(pubmedStudy.PMID, pubmedStudy);
        if (pubmedStudy.DOI) idToPubmedStudyMap.set(pubmedStudy.DOI, pubmedStudy);
    });

    const updatedBaseStudies: BaseStudy[] = [];

    originalBaseStudies.forEach((baseStudy) => {
        const associatedPubmedStudy =
            idToPubmedStudyMap.get(baseStudy.pmid || '') ||
            idToPubmedStudyMap.get(baseStudy.doi || '');

        let updatedBaseStudyWithDetails: BaseStudy = {};

        if (!associatedPubmedStudy) {
            updatedBaseStudyWithDetails = { ...baseStudy };
        } else {
            const authorString = (associatedPubmedStudy?.authors || []).reduce(
                (prev, curr, index, arr) =>
                    `${prev}${curr.ForeName} ${curr.LastName}${
                        index === arr.length - 1 ? '' : ', '
                    }`,
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
                publication: baseStudy.publication
                    ? baseStudy.publication
                    : associatedPubmedStudy.journal.title,
                year: baseStudy.year ? baseStudy.year : isValid ? value : undefined,
            };
        }

        const hasThisStudyAlready = updatedBaseStudies.some(
            ({ doi, pmid }) =>
                doi === updatedBaseStudyWithDetails.doi && pmid === updatedBaseStudyWithDetails.pmid
        );
        if (!hasThisStudyAlready) updatedBaseStudies.push(updatedBaseStudyWithDetails);
    });
    return updatedBaseStudies;
};

export const ingestBaseStudies = async (
    baseStudiesToIngest: BaseStudy[],
    sleuthUpload: ISleuthFileUploadStubs,
    userId: string,
    ingestCallback: (
        variables: BaseStudiesPostRequest,
        options?:
            | MutateOptions<
                  AxiosResponse<BaseStudiesPost200Response>,
                  AxiosError<any>,
                  BaseStudiesPostRequest,
                  unknown
              >
            | undefined
    ) => Promise<AxiosResponse<BaseStudiesPost200Response>>,
    updateProgressStateCallback: (value: number) => void
) => {
    const { data } = await ingestCallback(baseStudiesToIngest);

    // consolidate sleuth stubs into studies and create update requests
    const createStudyFromSleuthStubRequests = consolidateSleuthStubsIntoStudies(
        data as BaseStudyReturn[],
        sleuthUpload,
        userId
    );

    const studyResponses = await executeHTTPRequestsAsBatches(
        createStudyFromSleuthStubRequests,
        (requestObject) => {
            return requestObject.request === 'CREATE'
                ? API.NeurostoreServices.StudiesService.studiesPost(
                      undefined,
                      requestObject.studyId,
                      requestObject.data
                  )
                : API.NeurostoreServices.StudiesService.studiesIdPut(
                      requestObject.studyId,
                      requestObject.data
                  );
        },
        5,
        undefined,
        updateProgressStateCallback
    );
    return studyResponses.map((res) => res.data);
};

export const generateAnnotationForSleuthImport = (
    studyResponses: StudyReturn[],
    sleuthFilename: string
) => {
    // Later on, the library HandsOnTable will be used to render the annotaiton in a spreadsheet like UI.
    // We want to use the filename as a key, but we cannot include periods due to this issue:
    // https://github.com/handsontable/handsontable/issues/5439
    //
    // As a result, we should remove the period from the filename
    const remmoveSuffixAndPeriods = sleuthFilename.replaceAll('.', '_');

    // We want to use the filename as an inclusion column
    const noteKeys: { [key: string]: EPropertyType } = {
        included: EPropertyType.BOOLEAN,
        [remmoveSuffixAndPeriods]: EPropertyType.BOOLEAN,
    };

    // create a list of all analyses within all studies
    const analysisStudyList = studyResponses.reduce((acc, curr) => {
        const analysisStudyItems = (curr.analyses || []).map((analysisId) => ({
            analysisId: analysisId as string,
            studyId: curr.id as string,
        }));

        return [...acc, ...analysisStudyItems];
    }, [] as { analysisId: string; studyId: string }[]);

    const responsesToNotes: NoteCollectionReturn[] = analysisStudyList.map(
        ({ analysisId, studyId }) => ({
            analysis: analysisId,
            study: studyId,
            note: {
                included: true,
                [remmoveSuffixAndPeriods]: true,
            },
        })
    );

    return {
        noteKeys: noteKeys,
        notes: responsesToNotes,
    };
};

export const createProjectHelper = async (
    studysetId: string,
    annotationId: string,
    uploads: {
        studies: StudyReturn[];
        fileName: string;
    }[],
    createProjectCallback: (
        variables: Project,
        options?:
            | MutateOptions<AxiosResponse<ProjectReturn>, AxiosError<any>, Project, unknown>
            | undefined
    ) => Promise<AxiosResponse<ProjectReturn>>
) => {
    const fileNames = uploads.reduce((acc, curr, index) => {
        return index === 0 ? `${curr.fileName}` : `${acc}, ${curr.fileName}`;
    }, '');

    const newProjectData = generateNewProjectData(
        'Untitled sleuth project',
        `New project generated from files: ${fileNames}`
    );

    const curationMetadata: ICurationMetadata = initCurationHelper(
        ['not included', 'included'],
        false
    );

    curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies =
        sleuthIngestedStudiesToStubs(uploads);

    const setStudyStatusesAsComplete = uploads
        .reduce((acc, curr) => {
            return [...acc, ...curr.studies.map((x) => x.id as string)];
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
