import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { loadSchemas } from '../contract/schemas';
import type { PaperFilter, ReviewApi } from './reviewApi';

const ApiContext = createContext<ReviewApi | null>(null);

export function ApiProvider({ api, children }: { api: ReviewApi; children: ReactNode }) {
    return createElement(ApiContext.Provider, { value: api }, children);
}

export function useApi(): ReviewApi {
    const api = useContext(ApiContext);
    if (!api) throw new Error('useApi needs an ApiProvider');
    return api;
}

export const createQueryClient = () =>
    new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } },
    });

export function usePapers(filter: PaperFilter = {}) {
    const api = useApi();
    return useQuery({ queryKey: ['papers', filter], queryFn: () => api.listPapers(filter) });
}

export function useMe() {
    const api = useApi();
    return useQuery({ queryKey: ['me'], queryFn: () => api.getMe() });
}

export function useReviewers() {
    const api = useApi();
    return useQuery({ queryKey: ['reviewers'], queryFn: () => api.listReviewers() });
}

export interface AssignmentTarget {
    baseStudyId: string;
    userId: string;
}

/** One assignment change; the paper list refetches once it settles. */
function useAssignmentChange(change: (api: ReviewApi, target: AssignmentTarget) => Promise<void>) {
    const api = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (target: AssignmentTarget) => change(api, target),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['papers'] }),
    });
}

export type AssignmentMutation = ReturnType<typeof useAssignmentChange>;

export function useAssignment() {
    const assign = useAssignmentChange((api, { baseStudyId, userId }) => api.assign(baseStudyId, userId));
    const release = useAssignmentChange((api, { baseStudyId, userId }) => api.release(baseStudyId, userId));
    return { assign, release, error: assign.error ?? release.error };
}

export function useSchemas() {
    const api = useApi();
    return useQuery({ queryKey: ['schemas'], gcTime: Infinity, queryFn: () => loadSchemas(api.getSchema) });
}

export function useBundle(id: string) {
    const api = useApi();
    return useQuery({
        queryKey: ['bundle', id],
        gcTime: 0, // drop the bundle once its page is gone
        queryFn: async () => {
            const bundle = await api.getBundle(id);
            if (bundle.review) return bundle;
            await api.startReview(id); // the first open of a paper starts the caller's review
            return api.getBundle(id);
        },
    });
}
