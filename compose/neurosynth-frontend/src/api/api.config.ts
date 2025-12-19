import { axiosInstance, neurostoreConfig, neurosynthConfig } from './api.state';
import {
    StudiesApi,
    ConditionsApi,
    StudysetsApi as NeurostoreStudysetsApi,
    AnnotationsApi as NeurostoreAnnotationsApi,
    UserApi,
    PointsApi,
    ImagesApi,
    AnalysesApi,
    AnnotationBase,
    ResourceAttributes,
    Clone,
    AnnotationReturnRelationships,
    AnnotationCommon,
} from '../neurostore-typescript-sdk';
import {
    SpecificationsApi,
    MetaAnalysesApi,
    AnnotationsApi as NeurosynthAnnotationApi,
    StudysetsApi as NeurosynthStudysetApi,
    ProjectsApi,
    DefaultApi as NeurosynthDefaultApi,
} from '../neurosynth-compose-typescript-sdk';
import {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedDataForStudies';

export type NeurostoreAnnotation = AnnotationBase &
    ResourceAttributes &
    Clone &
    AnnotationReturnRelationships &
    AnnotationCommon;

const NeurostoreServices = {
    StudiesService: new StudiesApi(neurostoreConfig, undefined, axiosInstance),
    AnalysesService: new AnalysesApi(neurostoreConfig, undefined, axiosInstance),
    ConditionsService: new ConditionsApi(neurostoreConfig, undefined, axiosInstance),
    StudySetsService: new NeurostoreStudysetsApi(neurostoreConfig, undefined, axiosInstance),
    ImagesService: new ImagesApi(neurostoreConfig, undefined, axiosInstance),
    PointsService: new PointsApi(neurostoreConfig, undefined, axiosInstance),
    UsersService: new UserApi(neurostoreConfig, undefined, axiosInstance),
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
    AnnotationsService: new NeurostoreAnnotationsApi(neurostoreConfig, undefined, axiosInstance),
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
