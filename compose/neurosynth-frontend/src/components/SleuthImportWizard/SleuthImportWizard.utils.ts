/* eslint-disable @typescript-eslint/no-unused-vars */
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { BaseStudy } from 'neurostore-typescript-sdk';

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
            errorMessage: `Either DOI or PMID is required: Encountered error at: ${sleuthStudy.slice(
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
        space: expectedReferenceString,
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
