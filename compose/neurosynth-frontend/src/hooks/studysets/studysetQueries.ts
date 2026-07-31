import { UseQueryOptions } from '@tanstack/react-query';
import API from 'api/api.config';
import { AxiosError } from 'axios';
import { sortStudysetStudies } from 'hooks/studysets/studysetQueries.helpers';
import {
    StudysetReturnNested,
    StudysetReturnNonNested,
    StudysetReturnSummary,
} from 'hooks/studysets/studysetQueries.types';

const studysetQueries = {
    all: () => ['studysets'] as const,

    lists: () => [...studysetQueries.all(), 'list'] as const,

    details: () => [...studysetQueries.all(), 'detail'] as const,

    nonNestedById: (studysetId: string | undefined | null): UseQueryOptions<StudysetReturnNonNested, AxiosError> => ({
        queryKey: [...studysetQueries.details(), 'nonNested', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId as string,
                false,
                false,
                undefined
            );
            sortStudysetStudies(res.data);
            return res.data as StudysetReturnNonNested;
        },
        meta: { errorMessage: 'there was an error retrieving the studyset' },
        enabled: !!studysetId,
    }),

    nestedById: (studysetId: string | undefined | null): UseQueryOptions<StudysetReturnNested, AxiosError> => ({
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
        meta: { errorMessage: 'there was an error retrieving the studyset' },
        enabled: !!studysetId,
    }),

    summaryById: (studysetId: string | undefined | null): UseQueryOptions<StudysetReturnSummary, AxiosError> => ({
        queryKey: [...studysetQueries.details(), 'summary', studysetId] as const,
        queryFn: async () => {
            const res = await API.NeurostoreServices.StudySetsService.studysetsIdGet(
                studysetId as string,
                false,
                true,
                undefined
            );
            sortStudysetStudies(res.data);
            return res.data as StudysetReturnSummary;
        },
        meta: { errorMessage: 'there was an error retrieving the studyset' },
        enabled: !!studysetId,
    }),
};

export default studysetQueries;
