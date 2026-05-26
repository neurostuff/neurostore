import API from 'api/api.config';
import { ConditionReturn, ImageReturn, PointList } from 'neurostore-typescript-sdk';
import { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';

const analysisQueries = {
    analyses: {
        all: () => ['analyses'] as const,

        lists: () => [...analysisQueries.analyses.all(), 'list'] as const,

        details: () => [...analysisQueries.analyses.all(), 'detail'] as const,

        byStudyId: (studyId: string | undefined | null) => ({
            queryKey: [...analysisQueries.analyses.lists(), 'study', studyId] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.AnalysesService.analysesGet(
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    false,
                    studyId as string,
                    undefined,
                    true
                );
                return (res.data.results ?? []) as AnalysisReturnNested[];
            },
            enabled: !!studyId,
        }),

        byId: (analysisId: string | undefined | null) => ({
            queryKey: [...analysisQueries.analyses.details(), analysisId] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.AnalysesService.analysesIdGet(analysisId as string, true);
                return res.data as AnalysisReturnNested;
            },
            enabled: !!analysisId,
        }),
    },

    points: {
        all: () => ['points'] as const,
        list: () => [...analysisQueries.points.all(), 'list'] as const,
        details: () => [...analysisQueries.points.all(), 'detail'] as const,
        every: () => ({
            queryKey: ['points'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.PointsService.pointsGet();
                return res.data as PointList;
            },
            enabled: true,
        }),
    },

    images: {
        all: () => ['images'] as const,
        list: () => [...analysisQueries.images.all(), 'list'] as const,
        details: () => [...analysisQueries.images.all(), 'detail'] as const,
        uncategorizedByStudyId: (studyId: string | undefined | null) => ({
            queryKey: [...analysisQueries.images.list(), 'uncategorized', 'study', studyId] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.ImagesService.imagesGet(
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    false,
                    undefined,
                    studyId ?? undefined,
                    undefined,
                    undefined,
                    undefined
                );
                const studyImages = (res.data.results ?? []) as ImageReturn[];
                return studyImages.filter((image) => !image.analysis);
            },
            enabled: !!studyId,
        }),
    },

    conditions: {
        all: () => ({
            queryKey: ['conditions'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.ConditionsService.conditionsGet();
                return (res.data.results ?? []) as ConditionReturn[];
            },
            enabled: true,
        }),
    },

    mutations: {
        create: () => [...analysisQueries.analyses.all(), 'create'] as const,
        update: () => [...analysisQueries.analyses.all(), 'update'] as const,
        delete: () => [...analysisQueries.analyses.all(), 'delete'] as const,

        images: {
            update: () => [...analysisQueries.images.all(), 'update'] as const,
        },
    },
};

export default analysisQueries;
