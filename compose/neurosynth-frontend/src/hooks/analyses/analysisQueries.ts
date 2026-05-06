import API from 'api/api.config';
import { ConditionReturn, PointList } from 'neurostore-typescript-sdk';
import { AnalysisReturnNested, AnalysisReturnNonNested } from 'hooks/analyses/analysisQueries.types';

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
        all: () => ({
            queryKey: ['points'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.PointsService.pointsGet();
                return res.data as PointList;
            },
            enabled: true,
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
};

export default analysisQueries;
