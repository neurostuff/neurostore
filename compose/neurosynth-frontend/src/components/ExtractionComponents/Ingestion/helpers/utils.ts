import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { NoteCollectionReturn, StudyReturn, StudysetReturn } from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'utils/api';

export const getMatchingStudies = async (searchTerm: string): Promise<StudyReturn[]> => {
    try {
        const res = await API.NeurostoreServices.StudiesService.studiesGet(
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

        const databaseHasStubAlready = res.data.results || [];
        return databaseHasStubAlready;
    } catch (e) {
        throw new Error('error getting study');
    }
};

export const createStudyFromStub = async (stub: ICurationStubStudy): Promise<StudyReturn> => {
    try {
        const metadata: { [key: string]: any } = {};
        if (stub.articleLink) metadata.articleLink = stub.articleLink;
        if (stub.identificationSource)
            metadata.identificationSource = stub.identificationSource.label;
        if (stub.keywords) metadata.keywords = stub.keywords;
        if (stub.tags.length > 0) {
            stub.tags.forEach((tag, index) => {
                metadata[`tag_${index}`] = tag.label;
            });
        }

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
                metadata: metadata,
            }
        );

        return createdStudy.data;
    } catch (e) {
        throw new Error('error creating study from stub');
    }
};

export const updateStudyset = async (
    studysetId: string,
    currStudyset: string[]
): Promise<StudysetReturn> => {
    try {
        // 2. add the stub to the studyset
        const updatedStudyset = await API.NeurostoreServices.StudySetsService.studysetsIdPut(
            studysetId,
            {
                studies: [...currStudyset],
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
        validStudiesInStudyset: string[];
    } = {
        removedFromStudyset: [],
        stubsToIngest: [],
        validStudiesInStudyset: [],
    };

    const studysetSet = new Set<string>();
    studysetStudies.forEach((studyId) => {
        studysetSet.add(studyId);
    });

    curationStubs.forEach((stub) => {
        if (stub.neurostoreId) {
            if (studysetSet.has(stub.neurostoreId)) {
                returnObj.validStudiesInStudyset.push(stub.neurostoreId);
                studysetSet.delete(stub.neurostoreId);
            } else {
                returnObj.stubsToIngest.push(stub);
            }
        } else {
            returnObj.stubsToIngest.push(stub);
        }
    });

    studysetSet.forEach((item) => {
        returnObj.removedFromStudyset.push(item);
    });

    return returnObj;
};

export const setAnalysesInAnnotationAsIncluded = async (annotationId: string) => {
    try {
        const annotation = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
            annotationId
        )) as AxiosResponse<NeurostoreAnnotation>;

        const notes = (annotation.data.notes || []) as NoteCollectionReturn[];
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
