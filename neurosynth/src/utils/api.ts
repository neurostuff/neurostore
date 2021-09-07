import {
    AnalysesApiFactory,
    ConditionsApiFactory,
    Configuration,
    DatasetsApiFactory,
    ImagesApiFactory,
    PointsApiFactory,
    ReadOnly,
    StudiesApiFactory,
    Study,
    UserApiFactory,
} from '../gen/api';

export type StudyApiResponse = Study & ReadOnly;

const config: Configuration = new Configuration({
    basePath: 'https://neurostore.org/api',
});

const Services = {
    StudiesService: StudiesApiFactory(config, undefined, undefined),
    AnalysesService: AnalysesApiFactory(config, undefined, undefined),
    ConditionsService: ConditionsApiFactory(config, undefined, undefined),
    DataSetsService: DatasetsApiFactory(config, undefined, undefined),
    ImagesService: ImagesApiFactory(config, undefined, undefined),
    PointsService: PointsApiFactory(config, undefined, undefined),
    UsersService: UserApiFactory(config, undefined, undefined),
};

let setToken = '';

const UpdateServicesWithToken = (token: string) => {
    if (token !== setToken) {
        setToken = token;
        const config: Configuration = new Configuration({
            basePath: 'https://neurostore.org/api',
            baseOptions: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        Services.StudiesService = StudiesApiFactory(config, undefined, undefined);
        Services.AnalysesService = AnalysesApiFactory(config, undefined, undefined);
        Services.ConditionsService = ConditionsApiFactory(config, undefined, undefined);
        Services.DataSetsService = DatasetsApiFactory(config, undefined, undefined);
        Services.ImagesService = ImagesApiFactory(config, undefined, undefined);
        Services.PointsService = PointsApiFactory(config, undefined, undefined);
        Services.UsersService = UserApiFactory(config, undefined, undefined);
    }
};

const API = {
    Services,
    UpdateServicesWithToken,
};

export default API;
