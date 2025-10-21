import { AxiosError, AxiosResponse } from 'axios';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { stringToNumber } from 'helpers/utils';
import { INeurosynthParsedPubmedArticle } from 'hooks/external/useGetPubMedIds';
import { ICurationMetadata, IProvenance } from 'hooks/projects/useGetProjects';
import { BaseStudy, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { generateNewProjectData, initCurationHelper } from 'pages/Project/store/ProjectStore.helpers';
import { MutateOptions } from 'react-query';
import { sleuthIngestedStudiesToStubs } from './SleuthImport.convert';

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
    createProjectFunc: (
        variables: Project,
        options?: MutateOptions<AxiosResponse<ProjectReturn>, AxiosError, Project, unknown> | undefined
    ) => Promise<AxiosResponse<ProjectReturn>>
) => {
    const fileNames = uploads.reduce((acc, curr, index) => {
        return index === 0 ? `${curr.fileName}` : `${acc}, ${curr.fileName}`;
    }, '');

    const newProjectData = generateNewProjectData(
        'Untitled sleuth project',
        `New project generated from files: ${fileNames}`
    );

    const curationMetadata: ICurationMetadata = initCurationHelper(['Unreviewed', 'included'], false);

    curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies = sleuthIngestedStudiesToStubs(uploads);

    const setStudyStatusesAsComplete = uploads
        .reduce((acc, curr) => {
            return [...acc, ...curr.studyAnalysisList.map((x) => x.studyId)];
        }, [] as string[])
        .map((x) => ({
            id: x,
            status: EExtractionStatus.COMPLETED,
        }));

    return createProjectFunc({
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
