import axios from 'axios';
import {
    Configuration,
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
} from 'hooks/extractions/useGetAllExtractedData';

export type NeurostoreAnnotation = AnnotationBase &
    ResourceAttributes &
    Clone &
    AnnotationReturnRelationships &
    AnnotationCommon;

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

const NEUROSTORE_API_DOMAIN = import.meta.env.VITE_APP_NEUROSTORE_API_DOMAIN as string;
const NEUROSYNTH_API_DOMAIN = import.meta.env.VITE_APP_NEUROSYNTH_API_DOMAIN as string;

const neurostoreConfig: Configuration = new Configuration({
    basePath: NEUROSTORE_API_DOMAIN,
    accessToken: '',
});
const neurosynthConfig: Configuration = new Configuration({
    basePath: NEUROSYNTH_API_DOMAIN,
    accessToken: '',
});

const NeurostoreServices = {
    StudiesService: new StudiesApi(neurostoreConfig),
    AnalysesService: new AnalysesApi(neurostoreConfig),
    ConditionsService: new ConditionsApi(neurostoreConfig),
    StudySetsService: new NeurostoreStudysetsApi(neurostoreConfig),
    ImagesService: new ImagesApi(neurostoreConfig),
    PointsService: new PointsApi(neurostoreConfig),
    UsersService: new UserApi(neurostoreConfig),
    ExtractedDataResultsService: {
        getAllExtractedDataResults: (extractors: EAIExtractors[]) => {
            const extractorsSegment = extractors.reduce((acc, curr, index) => {
                if (index === 0) return `feature_display=${curr}`;
                return `${acc}&feature_display=${curr}`;
            }, '');

            return axios.get<{
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
            }>(`${neurostoreConfig.basePath}/pipeline-study-results/?${extractorsSegment}&paginate=false`, {
                headers: {
                    Authorization: `Bearer ${neurostoreConfig.accessToken}`,
                },
            });
        },
    },
    AnnotationsService: new NeurostoreAnnotationsApi(neurostoreConfig),
};

const NeurosynthServices = {
    MetaAnalysisService: new MetaAnalysesApi(neurosynthConfig),
    SpecificationsService: new SpecificationsApi(neurosynthConfig),
    StudysetsService: new NeurosynthStudysetApi(neurosynthConfig),
    AnnotationsService: new NeurosynthAnnotationApi(neurosynthConfig),
    ProjectsService: new ProjectsApi(neurosynthConfig),
    NeurosynthDefaultApi: new NeurosynthDefaultApi(neurosynthConfig),
};

const UpdateServicesWithToken = (token: string) => {
    if (env === 'DEV' || env === 'STAGING') console.log(token);
    neurostoreConfig.accessToken = token;
    neurosynthConfig.accessToken = token;
};

const API = {
    NeurostoreServices,
    NeurosynthServices,
    UpdateServicesWithToken,
};

export default API;
