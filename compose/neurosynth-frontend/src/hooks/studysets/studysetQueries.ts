import API from 'api/api.config';
import {
    StudysetReturnNested,
    StudysetReturnNonNested,
    StudysetReturnSummary,
} from 'hooks/studysets/studysetQueries.types';

const studysetQueries = {
    all: () => ['studysets'] as const,

    lists: () => [...studysetQueries.all(), 'list'] as const,

    details: () => [...studysetQueries.all(), 'detail'] as const,

    nonNestedById: (studysetId: string | undefined | null) => ({
        queryKey: [...studysetQueries.details(), 'nonNested', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId as string,
                false,
                false,
                undefined
            );
            return res.data as StudysetReturnNonNested;
        },
        enabled: !!studysetId,
    }),

    nestedById: (studysetId: string | undefined | null) => ({
        queryKey: [...studysetQueries.details(), 'nested', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId as string,
                true,
                false,
                undefined
            );
            return res.data as StudysetReturnNested;
        },
        enabled: !!studysetId,
    }),

    summaryById: (studysetId: string | undefined | null) => ({
        queryKey: [...studysetQueries.details(), 'summary', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId as string,
                false,
                true,
                undefined
            );
            return res.data as StudysetReturnSummary;
        },
        enabled: !!studysetId,
    }),
};

export default studysetQueries;
