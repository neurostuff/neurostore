import { AxiosError, AxiosRequestHeaders, AxiosResponse, AxiosResponseHeaders } from 'axios';
import {
    AnalysisRequest,
    AnalysisReturn,
    BaseStudiesPost200Response,
    BaseStudiesPostRequest,
    BaseStudy,
    BaseStudyReturn,
    StudyRequest,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { ISleuthFileUploadStubs, PUBMED_API_KEY } from '.';
import { DefaultSpaceTypes, IStudyVersion } from 'pages/Study/store/StudyStore.helpers';
import API from 'api/api.config';
import { selectBestBaseStudyVersion } from 'helpers/Extraction.helpers';
import { IESearchResult } from 'hooks/external/useGetPubMedIdFromDOI';
import { INeurosynthParsedPubmedArticle } from 'hooks/external/useGetPubMedIds';
import { executeHTTPRequestsAsBatches } from 'helpers/requests';
import { MutateOptions } from 'react-query';

/**
 * This helper function takes each sleuth study and returns either a POST request to create a study with analyses, or a POST request to create an
 * analysis
 *
 * If multiple sleuth studies refer to the same study, and the new study is being newly created, then this would be one HTTP request.
 * If multiple sleuth studies refer to the same study, and a version is already owner by the current user, then this would be multiple HTTP requests
 */
const organizeSleuthStubsIntoHTTPRequests = (
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
            ([, value]) =>
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
                        headers: {} as AxiosResponseHeaders,
                        config: { headers: {} as AxiosRequestHeaders },
                    };
                    res(fakeAxiosResponse);
                });
            } else {
                // if a study does not have a PMID, it must have a DOI (already validated in upload)
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

export const ingestBaseStudies = async (
    baseStudiesWithPubmedDetailsNoDuplicates: BaseStudy[],
    sleuthUpload: ISleuthFileUploadStubs,
    userId: string,
    ingestCallback: (
        variables: BaseStudiesPostRequest,
        options?:
            | MutateOptions<AxiosResponse<BaseStudiesPost200Response>, AxiosError, BaseStudiesPostRequest, unknown>
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
