import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { NoteCollectionReturn, StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'utils/api';

export const getMatchingStudies = async (searchTerm: string): Promise<StudyReturn[]> => {
    try {
        const study = await API.NeurostoreServices.StudiesService.studiesGet(
            searchTerm,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined
        );

        const databaseHasStubAlready = study.data.results || [];
        return databaseHasStubAlready;
    } catch (e) {
        throw new Error('error getting study');
    }
};

export const createStudyFromStub = async (stub: ICurationStubStudy): Promise<StudyReturn> => {
    try {
        // 1. create study using the stub
        const createdStudy = await API.NeurostoreServices.StudiesService.studiesPost(
            undefined,
            undefined,
            {
                name: stub.title,
                doi: stub.doi,
                description: stub.abstractText,
                publication: stub.journal,
                pmid: stub.pmid,
                authors: stub.authors,
                year: parseInt(stub.articleYear || '0'),
            }
        );

        return createdStudy.data;
    } catch (e) {
        throw new Error('error creating study from stub');
    }
};

export const addStudyToStudyset = async (
    studysetId: string,
    studyId: string,
    currStudyset: string[]
): Promise<StudysetReturn> => {
    // add study to studyset and handle update currStudyset
    try {
        // 2. add the stub to the studyset
        const updatedStudyset = await API.NeurostoreServices.StudySetsService.studysetsIdPut(
            studysetId,
            {
                studies: [...currStudyset, studyId as string],
            }
        );

        return updatedStudyset.data;
    } catch (e) {
        throw new Error('error adding study to studyset');
    }
};

export const resolveStudysetAndCurationDifferences = (
    curationStubs: ICurationStubStudy[],
    studysetStudies: string[]
) => {
    const returnObj: {
        removedFromStudyset: string[];
        stubsToIngest: ICurationStubStudy[];
        studiesInStudyset: string[];
    } = {
        removedFromStudyset: [],
        stubsToIngest: [],
        studiesInStudyset: [],
    };

    const studysetSet = new Set<string>();
    studysetStudies.forEach((studyId) => studysetSet.add(studyId));

    curationStubs.forEach((stub) => {
        if (stub.neurostoreId) {
            if (studysetSet.has(stub.neurostoreId)) {
                returnObj.studiesInStudyset.push(stub.neurostoreId);
                studysetSet.delete(stub.neurostoreId);
            } else {
                returnObj.stubsToIngest.push(stub);
            }
        } else {
            returnObj.stubsToIngest.push(stub);
        }
    });

    for (const entry in studysetSet) {
        returnObj.removedFromStudyset.push(entry);
    }

    return returnObj;
};

export const setAnalysesInAnnotationAsIncluded = async (annotationId: string) => {
    try {
        const annotation = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
            annotationId
        )) as AxiosResponse<NeurostoreAnnotation>;

        const notes = (annotation.data.notes || []) as NoteCollectionReturn[];
        // need to finish updating the annotations to set all notes to be included: TRUE
        await API.NeurostoreServices.AnnotationsService.annotationsIdPut(annotationId, {
            notes: [],
        });
        console.log(annotation);
    } catch (e) {
        throw new Error('error creating study from stub');
    }
};
