import { QueryClient, useQuery } from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { loadSchemas } from '../contract/schemas';
import type { ReviewApi } from './reviewApi';

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

export function usePapers() {
    const api = useApi();
    return useQuery({ queryKey: ['papers'], queryFn: () => api.listPapers() });
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
