import {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedDataForStudies';
import { StoreApi } from '../neurostore-typescript-sdk';
import {
    MetaAnalysesApi,
    AnnotationsApi as NeurosynthAnnotationApi,
    DefaultApi as NeurosynthDefaultApi,
    StudysetsApi as NeurosynthStudysetApi,
    ProjectsApi,
    SpecificationsApi,
} from '../neurosynth-compose-typescript-sdk';
import { axiosInstance, neurostoreConfig, neurosynthConfig } from './api.state';

const storeApi = new StoreApi(neurostoreConfig, undefined, axiosInstance);

const NeurostoreServices = {
    StudiesService: storeApi,
    BaseStudiesService: storeApi,
    AnalysesService: storeApi,
    ConditionsService: storeApi,
    StudySetsService: storeApi,
    ImagesService: storeApi,
    PointsService: storeApi,
    UsersService: storeApi,
    ExtractedDataResultsService: {
        getAllExtractedDataResults: (extractors: EAIExtractors[], baseStudyIds?: string[]) => {
            const extractorsSegment = extractors.reduce((acc, curr, index) => {
                if (index === 0) return `feature_display=${curr}`;
                return `${acc}&feature_display=${curr}`;
            }, '');

            const baseStudyIdsSegment = (baseStudyIds ?? []).reduce((acc, curr, index) => {
                if (index === 0) return `study_id=${curr}`;
                return `${acc}&study_id=${curr}`;
            }, '');

            return axiosInstance.post<{
                metadata: {
                    total_count: number;
                };
                results: {
                    base_study_id: string;
                    config_id: string;
                    date_executed: string;
                    file_inputs: { [path: string]: string };
                    id: string;
                    result_data: ITaskExtractor | IParticipantDemographicExtractor;
                }[];
            }>(
                `${neurostoreConfig.basePath}/pipeline-study-results/?${extractorsSegment}&paginate=false`,
                {
                    study_ids: baseStudyIds,
                },
                {
                    headers: {
                        Authorization: `Bearer ${neurostoreConfig.accessToken}`,
                    },
                }
            );
        },
    },
    AnnotationsService: storeApi,
};

const NeurosynthServices = {
    MetaAnalysisService: new MetaAnalysesApi(neurosynthConfig, undefined, axiosInstance),
    SpecificationsService: new SpecificationsApi(neurosynthConfig, undefined, axiosInstance),
    StudysetsService: new NeurosynthStudysetApi(neurosynthConfig, undefined, axiosInstance),
    AnnotationsService: new NeurosynthAnnotationApi(neurosynthConfig, undefined, axiosInstance),
    ProjectsService: new ProjectsApi(neurosynthConfig, undefined, axiosInstance),
    NeurosynthDefaultApi: new NeurosynthDefaultApi(neurosynthConfig, undefined, axiosInstance),
};

const API = {
    NeurostoreServices,
    NeurosynthServices,
};

export default API;
