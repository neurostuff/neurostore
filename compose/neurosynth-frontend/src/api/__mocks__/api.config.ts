import { vi } from 'vitest';
import { mockAnnotations, mockStudy, mockStudysets } from '../../testing/mockData';

const MockAPI = {
    NeurosynthServices: {},
    NeurostoreServices: {
        StudiesService: {
            studiesGet: vi.fn(),
            studiesIdGet: vi.fn().mockReturnValue(Promise.resolve({ data: mockStudy() })),
            studiesIdPut: vi.fn().mockReturnValue(Promise.resolve(mockStudy())),
            studiesPost: vi.fn(),
            studiesIdDelete: vi.fn(),
        },
        AnalysesService: {
            analysesGet: vi.fn(),
            analysesIdGet: vi.fn(),
            analysesIdPut: vi.fn(),
            analysesPost: vi.fn(),
            analysesIdDelete: vi.fn(),
            annotationAnalysesPost: vi.fn(),
        },
        ConditionsService: {
            conditionsGet: vi.fn(),
            conditionsIdGet: vi.fn(),
            conditionsIdPut: vi.fn(),
            conditionsPost: vi.fn(),
            conditionsIdDelete: vi.fn(),
        },
        StudySetsService: {
            studysetsGet: vi.fn().mockReturnValue(
                Promise.resolve({
                    data: {
                        metadata: {},
                        results: mockStudysets(),
                    },
                })
            ),
            studysetsIdGet: vi.fn(),
            studysetsIdPut: vi.fn(),
            studysetsPost: vi.fn(),
            studysetsIdDelete: vi.fn(),
        },
        ImagesService: {
            studysetsGet: vi.fn(),
            studysetsIdGet: vi.fn(),
            studysetsIdPut: vi.fn(),
            studysetsPost: vi.fn(),
            studysetsIdDelete: vi.fn(),
        },
        PointsService: {
            pointsGet: vi.fn(),
            pointsIdGet: vi.fn(),
            pointsIdPut: vi.fn(),
            pointsPost: vi.fn(),
            pointsIdDelete: vi.fn(),
        },
        UsersService: {
            usersGet: vi.fn(),
            usersIdGet: vi.fn(),
            usersIdPut: vi.fn(),
            usersPost: vi.fn(),
        },
        AnnotationsService: {
            annotationsGet: vi.fn().mockReturnValue(
                Promise.resolve({
                    data: {
                        metadata: {},
                        results: mockAnnotations(),
                    },
                })
            ),
            annotationsIdGet: vi.fn(),
            annotationsIdPut: vi.fn(),
            annotationsPost: vi.fn(),
            annotationsIdDelete: vi.fn(),
        },
    },
};

export default MockAPI;
