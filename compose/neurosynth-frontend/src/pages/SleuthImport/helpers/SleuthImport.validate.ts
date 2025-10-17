import { stringToNumber } from 'helpers/utils';
import { cleanLine, parseKeyVal } from './SleuthImport.parse';

export const isCoordLine = (lineRaw: string) => {
    const line = lineRaw.trim();
    if (!line) return false;
    // exactly three numeric tokens separated by whitespace (the same pattern is repeated three times)
    return /^\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*$/.test(line);
};

export const stringsAreValidFileFormat = (sleuthStudy: string): { isValid: boolean; errorMessage?: string } => {
    let containsDOI = false;
    let containsPMID = false;
    let containsAtLeastOneExperimentName = false;
    let hasReachedCoordinates = false;

    const lines = sleuthStudy.split('\n').map((l) => l.trimEnd());

    for (const rawLine of lines) {
        if (!rawLine.trim()) continue; // ignore blank lines

        if (hasReachedCoordinates) {
            if (!isCoordLine(rawLine)) {
                return { isValid: false, errorMessage: `Invalid coordinates: ${rawLine}` };
            }
            continue; // keep consuming coordinates
        }

        const kv = parseKeyVal(rawLine);
        if (kv) {
            if (kv.key === 'subjects') {
                const { isValid } = stringToNumber(kv.value);
                if (!isValid) {
                    return {
                        isValid: false,
                        errorMessage: `Expected number of subjects. Encountered error at: ${rawLine}`,
                    };
                }
                hasReachedCoordinates = true; // assume coordinates follow
                continue;
            }
            if (kv.key === 'doi') {
                if (!kv.value) return { isValid: false, errorMessage: `Expected valid DOI. At: ${rawLine}` };
                if (containsDOI) return { isValid: false, errorMessage: `Encountered multiple DOIs: ${rawLine}` };
                containsDOI = true;
                continue;
            }
            if (kv.key === 'pubmedid') {
                if (!kv.value) return { isValid: false, errorMessage: `Expected valid PMID. At: ${rawLine}` };
                if (containsPMID)
                    return { isValid: false, errorMessage: `Encountered multiple PubMed IDs: ${rawLine}` };
                containsPMID = true;
                continue;
            }
            // only accept known keys (subjects, doi, pubmedid) as allowed metadata; unknown key=value is invalid
            if (!['subjects', 'doi', 'pubmedid'].includes(kv.key)) {
                return { isValid: false, errorMessage: `Unexpected format. Encountered unknown property: ${rawLine}` };
            }
            continue;
        }

        // Not key=value; expect "AUTHOR : EXPERIMENT"
        const line = cleanLine(rawLine);
        const [authorInfo, ...experimentName] = line.split(':');
        if (!experimentName?.join('').trim()) {
            return {
                isValid: false,
                errorMessage: `Unexpected format. (Hint: Did you omit a colon or use a semi colon instead of a colon?) Encountered error at: ${line}`,
            };
        }
        if (!authorInfo?.trim()) {
            return {
                isValid: false,
                errorMessage: `Unexpected format. (Hint: Did you forget to include the author(s)?) Encountered error at: ${rawLine}`,
            };
        }
        containsAtLeastOneExperimentName = true;
    }

    // need at least one identifier
    if (!containsDOI && !containsPMID) {
        return {
            isValid: false,
            errorMessage:
                "Either DOI or PMID is required. (Formats like 'DOI=...' or '// DOI=...' or '/DOI=...' are accepted.)",
        };
    }
    if (!containsAtLeastOneExperimentName) {
        return { isValid: false, errorMessage: 'At least one experiment name is required.' };
    }

    return { isValid: true };
};

export const validateFileContents = (fileContents: string): { isValid: boolean; errorMessage?: string } => {
    // we expect the first meaningful line to be "Reference = <space>"
    // we can also assume that all line endings are \n as fileContents have been normalized
    const lines = fileContents.split('\n');
    // find first non-empty, meaningful line
    let i = 0;
    while (i < lines.length && !cleanLine(lines[i])) i++;
    if (i >= lines.length) {
        return { isValid: false, errorMessage: 'File has no data' };
    }
    const refKV = parseKeyVal(lines[i]);
    if (!refKV || refKV.key !== 'reference' || !refKV.value) {
        return {
            isValid: false,
            errorMessage: 'No coordinate reference space specified (e.g. expecting REFERENCE property)',
        };
    }
    const space = refKV.value;
    if (!space) {
        return {
            isValid: false,
            errorMessage: 'No coordinate reference space specified (e.g. expecting REFERENCE property)',
        };
    }

    // split studies by blank lines after reference
    const studyChunks: string[] = [];
    let chunk: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
        const raw = lines[j];
        // trim() removes whitespace as well as \n
        if (!raw.trim()) {
            if (chunk.length) {
                studyChunks.push(chunk.join('\n'));
                chunk = [];
            }
            continue;
        }
        chunk.push(raw);
    }
    if (chunk.length) studyChunks.push(chunk.join('\n'));

    for (const sleuthStudy of studyChunks) {
        const { isValid, errorMessage = '' } = stringsAreValidFileFormat(sleuthStudy);
        if (!isValid) {
            return {
                isValid: false,
                errorMessage: errorMessage || `Unexpected format. Encountered at: ${sleuthStudy.slice(0, 80)}...`,
            };
        }
    }
    return { isValid: true, errorMessage: undefined };
};
