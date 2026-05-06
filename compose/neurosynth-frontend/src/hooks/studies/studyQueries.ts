import API from 'api/api.config';
import type {
    BaseStudyListFlat,
    BaseStudyListInfo,
    BaseStudyListNested,
    BaseStudyListNonNested,
    BaseStudyReturnFlat,
    BaseStudyReturnInfo,
    BaseStudyReturnNested,
    BaseStudyReturnNonNested,
    StudyReturnNested,
    StudyReturnNonNested,
} from 'hooks/studies/studyQueries.types';
import { baseStudiesSearchHelper, mergeBaseStudiesSearchShape } from 'hooks/studies/useGetBaseStudies.helpers';
import { SearchCriteria } from 'pages/Study/Study.types';

const studyQueries = {
    studies: {
        all: () => ['studies'] as const,

        lists: () => [...studyQueries.studies.all(), 'list'] as const,

        details: () => [...studyQueries.studies.all(), 'detail'] as const,

        /** GET /studies/:id with `nested=true` (nested analysis payloads). */
        byIdNested: (studyId: string | undefined | null) => ({
            queryKey: [...studyQueries.studies.details(), studyId, true] as const,
            queryFn: async (): Promise<StudyReturnNested> => {
                const res = await API.NeurostoreServices.StudiesService.studiesIdGet(studyId || '', true);
                return res.data as StudyReturnNested;
            },
            enabled: !!studyId,
        }),

        /** GET /studies/:id with `nested=false` (analysis ids / non-nested shape). */
        byIdNonNested: (studyId: string | undefined | null) => ({
            queryKey: [...studyQueries.studies.details(), studyId, false] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.StudiesService.studiesIdGet(studyId || '', false);
                return res.data as StudyReturnNonNested;
            },
            enabled: !!studyId,
        }),
    },

    baseStudies: {
        all: () => ['base-studies'] as const,

        lists: () => [...studyQueries.baseStudies.all(), 'list'] as const,

        details: () => [...studyQueries.baseStudies.all(), 'detail'] as const,

        /** GET /base-studies/:id — `nested=true`, full version payloads. */
        byIdNested: (baseStudyId: string | undefined | null) => ({
            queryKey: [...studyQueries.baseStudies.details(), baseStudyId, 'nested'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(
                    baseStudyId || '',
                    false,
                    false,
                    true
                );
                return res.data as BaseStudyReturnNested;
            },
            enabled: !!baseStudyId,
        }),

        /** GET /base-studies/:id — `nested=false`, version ids only. */
        byIdNonNested: (baseStudyId: string | undefined | null) => ({
            queryKey: [...studyQueries.baseStudies.details(), baseStudyId, 'non-nested'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(
                    baseStudyId || '',
                    false,
                    false,
                    false
                );
                return res.data as BaseStudyReturnNonNested;
            },
            enabled: !!baseStudyId,
        }),

        /** GET /base-studies/:id — `flat=true`, versions omitted from payload. */
        byIdFlat: (baseStudyId: string | undefined | null) => ({
            queryKey: [...studyQueries.baseStudies.details(), baseStudyId, 'flat'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(
                    baseStudyId || '',
                    true,
                    false,
                    false
                );
                return res.data as BaseStudyReturnFlat;
            },
            enabled: !!baseStudyId,
        }),

        /** GET /base-studies/:id — `info=true`, slim version rows. */
        byIdInfo: (baseStudyId: string | undefined | null) => ({
            queryKey: [...studyQueries.baseStudies.details(), baseStudyId, 'info'] as const,
            queryFn: async () => {
                const res = await API.NeurostoreServices.BaseStudiesService.baseStudiesIdGet(
                    baseStudyId || '',
                    false,
                    true,
                    false
                );
                return res.data as BaseStudyReturnInfo;
            },
            enabled: !!baseStudyId,
        }),

        debouncedSearchNested: (searchCriteria: Partial<SearchCriteria>) => ({
            queryKey: [...studyQueries.baseStudies.lists(), 'debounced', 'nested', { ...searchCriteria }] as const,
            queryFn: async () => {
                const res = await baseStudiesSearchHelper(mergeBaseStudiesSearchShape(searchCriteria, 'nested'));
                return res.data as BaseStudyListNested;
            },
        }),

        debouncedSearchNonNested: (searchCriteria: Partial<SearchCriteria>) => ({
            queryKey: [...studyQueries.baseStudies.lists(), 'debounced', 'non-nested', { ...searchCriteria }] as const,
            queryFn: async () => {
                const res = await baseStudiesSearchHelper(mergeBaseStudiesSearchShape(searchCriteria, 'nonNested'));
                return res.data as BaseStudyListNonNested;
            },
        }),

        debouncedSearchFlat: (searchCriteria: Partial<SearchCriteria>) => ({
            queryKey: [...studyQueries.baseStudies.lists(), 'debounced', 'flat', { ...searchCriteria }] as const,
            queryFn: async () => {
                const res = await baseStudiesSearchHelper(mergeBaseStudiesSearchShape(searchCriteria, 'flat'));
                return res.data as BaseStudyListFlat;
            },
        }),

        debouncedSearchInfo: (searchCriteria: Partial<SearchCriteria>) => ({
            queryKey: [...studyQueries.baseStudies.lists(), 'debounced', 'info', { ...searchCriteria }] as const,
            queryFn: async () => {
                const res = await baseStudiesSearchHelper(mergeBaseStudiesSearchShape(searchCriteria, 'info'));
                return res.data as BaseStudyListInfo;
            },
        }),
    },
};

export default studyQueries;
