import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { NoteCollectionReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { SearchCriteria } from 'pages/Studies/StudiesPage/models';
import API, { NeurostoreAnnotation } from 'utils/api';

const getSearchCriteriaFromURL = (locationURL?: string): SearchCriteria => {
    const newSearchCriteria = new SearchCriteria();
    if (locationURL) {
        const search = new URLSearchParams(locationURL);

        let searchCriteriaObj: any = {}; // have to force this to be any so that we can assign props to the object
        for (const [key, value] of search) {
            if (key === 'pageOfResults' || key === 'pageSize') {
                const parsedValue = parseInt(value);
                if (!isNaN(parsedValue)) searchCriteriaObj[key] = parsedValue;
            } else if (key === 'descOrder' || key === 'showUnique') {
                const parsedValue = value === 'true';
                searchCriteriaObj[key] = parsedValue;
            } else if (key in newSearchCriteria) {
                searchCriteriaObj[key] = value;
            }
        }
        return {
            ...newSearchCriteria,
            ...searchCriteriaObj,
        };
    }
    return newSearchCriteria;
};

const getURLFromSearchCriteria = (searchCriteria: Partial<SearchCriteria>) => {
    let stringifiedValueSearch: Record<string, string> = {};
    for (let [key, value] of Object.entries(searchCriteria)) {
        if (value === undefined) continue;
        stringifiedValueSearch[key] = `${value}`;
    }
    const search = new URLSearchParams(stringifiedValueSearch);
    return search.toString();
};

const addKVPToSearch = (locationURL: string, key: string, value: string) => {
    const search = new URLSearchParams(locationURL);
    search.has(key) ? search.set(key, value) : search.append(key, value);
    return search.toString();
};

/**
 * Most common hashcode implementations multiply by 31 for mathematical reasons as it is odd, prime, and provides an acceptable distribution with minimal collisions:
 * https://stackoverflow.com/questions/299304/why-does-javas-hashcode-in-string-use-31-as-a-multiplier
 */
const stringToColor = (stringArg: string) => {
    // first step: create binary hashcode from string
    let hash = 0;
    for (let i = 0; i < stringArg.length; i++) {
        const charCode = stringArg.charCodeAt(i);
        const multiplier = (hash << 5) - hash; // Mathematically, 31 * i === (i << 5) - i
        hash = charCode + multiplier;
    }
    // second step: create hexadecimal string
    // a hexadecimal string describes the RGB value with the first two digits corresponding to R, second two to G, and final two to B.
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff; // mask the ith 8th binary digits which correspond to a number between 0 and 255
        const hexColor = `00${value.toString(16)}`; // need the '00' to pad in case we don't have enough hexadecimal digits
        color = `${color}${hexColor.substring(hexColor.length - 2)}`;
    }
    return color;
};

const getNumStudiesString = (studies: any[] | undefined): string => {
    if (!studies) {
        return '0 studies';
    } else if (studies.length === 1) {
        return '1 study';
    } else {
        return `${studies.length} studies`;
    }
};

// returns bool representing whether or not there is a difference between the curation included studies and what is currently in the studyset
const resolveStudysetAndCurationDifferences = (
    curationStubs: ICurationStubStudy[],
    studysetStudies: StudyReturn[]
): boolean => {
    if (curationStubs.length !== studysetStudies.length) return true;

    const studysetSet = new Set();
    studysetStudies.forEach((studysetStudy) => {
        if (studysetStudy.name) studysetSet.add((studysetStudy.name || '').toLocaleLowerCase());
        if (studysetStudy.pmid) studysetSet.add(studysetStudy.pmid);
        if (studysetStudy.doi) studysetSet.add(studysetStudy.doi);
    });

    curationStubs.forEach((stub) => {
        if (
            !studysetSet.has(stub.title) &&
            !studysetSet.has(stub.pmid) &&
            !studysetSet.has(stub.doi)
        ) {
            return true;
        }
    });

    return false;
};

const setAnalysesInAnnotationAsIncluded = async (annotationId: string) => {
    try {
        const annotation = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
            annotationId
        )) as AxiosResponse<NeurostoreAnnotation>;

        let notes = (annotation.data.notes || []) as NoteCollectionReturn[];

        await API.NeurostoreServices.AnnotationsService.annotationsIdPut(annotationId, {
            notes: notes.map((x) => ({
                analysis: x.analysis,
                study: x.study,
                note: {
                    ...x.note,
                    // included can be null meaning it has not been instantiated. We only want to set it to true
                    // if it has not been instantiated as that will overwrite the value is the user previously set it to false
                    included: (x.note as any)?.included === false ? false : true,
                },
            })),
        });
    } catch (e) {
        console.error(e);
        throw new Error('error setting annotations as included');
    }
};

export {
    getSearchCriteriaFromURL,
    getURLFromSearchCriteria,
    addKVPToSearch,
    stringToColor,
    getNumStudiesString,
    resolveStudysetAndCurationDifferences,
    setAnalysesInAnnotationAsIncluded,
};
