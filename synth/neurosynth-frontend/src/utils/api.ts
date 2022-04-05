import {
    AnalysesApiFactory,
    Analysis,
    Annotation,
    AnnotationsApiFactory,
    Condition,
    ConditionsApiFactory,
    Configuration,
    Studyset,
    StudysetsApiFactory,
    ImagesApiFactory,
    Point,
    PointsApiFactory,
    ReadOnly,
    StudiesApiFactory,
    Study,
    UserApiFactory,
    Image,
} from '../neurostore-typescript-sdk';

export type StudyApiResponse = Study & ReadOnly;
export type AnalysisApiResponse = Analysis & ReadOnly;
export type PointsApiResponse = Point & ReadOnly;
export type StudysetsApiResponse = Studyset & ReadOnly;
export type AnnotationsApiResponse = Annotation & ReadOnly;
export type ConditionApiResponse = Condition & ReadOnly;
export type ImageApiResponse = Image & ReadOnly;

const APIDomain = process.env.REACT_APP_API_DOMAIN as string;
let TOKEN = '';
const config: Configuration = new Configuration({
    basePath: APIDomain,
});

const Services = {
    StudiesService: StudiesApiFactory(config, undefined, undefined),
    AnalysesService: AnalysesApiFactory(config, undefined, undefined),
    ConditionsService: ConditionsApiFactory(config, undefined, undefined),
    StudySetsService: StudysetsApiFactory(config, undefined, undefined),
    ImagesService: ImagesApiFactory(config, undefined, undefined),
    PointsService: PointsApiFactory(config, undefined, undefined),
    UsersService: UserApiFactory(config, undefined, undefined),
    AnnotationsService: AnnotationsApiFactory(config, undefined, undefined),
};

const UpdateServicesWithToken = (token: string) => {
    if (token !== TOKEN) {
        const config: Configuration = new Configuration({
            basePath: APIDomain,
            baseOptions: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        Services.StudiesService = StudiesApiFactory(config, undefined, undefined);
        Services.AnalysesService = AnalysesApiFactory(config, undefined, undefined);
        Services.ConditionsService = ConditionsApiFactory(config, undefined, undefined);
        Services.StudySetsService = StudysetsApiFactory(config, undefined, undefined);
        Services.ImagesService = ImagesApiFactory(config, undefined, undefined);
        Services.PointsService = PointsApiFactory(config, undefined, undefined);
        Services.UsersService = UserApiFactory(config, undefined, undefined);
        Services.AnnotationsService = AnnotationsApiFactory(config, undefined, undefined);

        TOKEN = token;
    }
};

const API = {
    Services,
    UpdateServicesWithToken,
};

export default API;
