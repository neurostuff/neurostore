import { mockAnnotations, mockStudysets } from '../../testing/mockData';

const MockAPI = {
    NeurosynthServices: {},
    NeurostoreServices: {
        StudiesService: {
            studiesGet: jest.fn(),
            studiesIdGet: jest.fn(),
            studiesIdPut: jest.fn(),
            studiesPost: jest.fn(),
            studiesIdDelete: jest.fn(),
        },
        AnalysesService: {
            analysesGet: jest.fn(),
            analysesIdGet: jest.fn(),
            analysesIdPut: jest.fn(),
            analysesPost: jest.fn(),
            analysesIdDelete: jest.fn(),
        },
        ConditionsService: {
            conditionsGet: jest.fn(),
            conditionsIdGet: jest.fn(),
            conditionsIdPut: jest.fn(),
            conditionsPost: jest.fn(),
            conditionsIdDelete: jest.fn(),
        },
        StudySetsService: {
            studysetsGet: jest.fn().mockReturnValue(
                Promise.resolve({
                    data: {
                        metadata: {},
                        results: mockStudysets(),
                    },
                })
            ),
            studysetsIdGet: jest.fn(),
            studysetsIdPut: jest.fn(),
            studysetsPost: jest.fn(),
            studysetsIdDelete: jest.fn(),
        },
        ImagesService: {
            studysetsGet: jest.fn(),
            studysetsIdGet: jest.fn(),
            studysetsIdPut: jest.fn(),
            studysetsPost: jest.fn(),
            studysetsIdDelete: jest.fn(),
        },
        PointsService: {
            pointsGet: jest.fn(),
            pointsIdGet: jest.fn(),
            pointsIdPut: jest.fn(),
            pointsPost: jest.fn(),
            pointsIdDelete: jest.fn(),
        },
        UsersService: {
            usersGet: jest.fn(),
            usersIdGet: jest.fn(),
            usersIdPut: jest.fn(),
            usersPost: jest.fn(),
        },
        AnnotationsService: {
            annotationsGet: jest.fn().mockReturnValue(
                Promise.resolve({
                    data: {
                        metadata: {},
                        results: mockAnnotations(),
                    },
                })
            ),
            annotationsIdGet: jest.fn(),
            annotationsIdPut: jest.fn(),
            annotationsPost: jest.fn(),
            annotationsIdDelete: jest.fn(),
        },
    },
    UpdateServicesWithToken: jest.fn(),
};

export default MockAPI;
