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
} from '../neurostore-typescript-sdk';
import {
    SpecificationApi,
    MetaAnalysisApi,
    AnnotationApi as NeurosynthAnnotationApi,
    StudysetApi as NeurosynthStudysetApi,
} from '../neurosynth-compose-typescript-sdk';

const NEUROSTORE_API_DOMAIN = process.env.REACT_APP_NEUROSTORE_API_DOMAIN as string;
const NEUROSYNTH_API_DOMAIN = process.env.REACT_APP_NEUROSYNTH_API_DOMAIN as string;

let TOKEN = '';
const neurostoreConfig: Configuration = new Configuration({
    basePath: NEUROSTORE_API_DOMAIN,
    accessToken: TOKEN,
});
const neurosynthConfig: Configuration = new Configuration({
    basePath: NEUROSYNTH_API_DOMAIN,
    accessToken: TOKEN,
});

const NeurostoreServices = {
    StudiesService: new StudiesApi(neurostoreConfig),
    AnalysesService: new AnalysesApi(neurostoreConfig),
    ConditionsService: new ConditionsApi(neurostoreConfig),
    StudySetsService: new NeurostoreStudysetsApi(neurostoreConfig),
    ImagesService: new ImagesApi(neurostoreConfig),
    PointsService: new PointsApi(neurostoreConfig),
    UsersService: new UserApi(neurostoreConfig),
    AnnotationsService: new NeurostoreAnnotationsApi(neurostoreConfig),
};

const NeurosynthServices = {
    MetaAnalysisService: new MetaAnalysisApi(neurosynthConfig),
    SpecificationsService: new SpecificationApi(neurosynthConfig),
    StudysetsService: new NeurosynthStudysetApi(neurosynthConfig),
    AnnotationsService: new NeurosynthAnnotationApi(neurosynthConfig),
};

const UpdateServicesWithToken = (token: string) => {
    neurostoreConfig.accessToken = token;
    neurosynthConfig.accessToken = token;
};

const API = {
    NeurostoreServices,
    NeurosynthServices,
    UpdateServicesWithToken,
};

export default API;
