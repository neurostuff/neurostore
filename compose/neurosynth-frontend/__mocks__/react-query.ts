import { vi } from 'vitest';

const useQueryClient = vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    getQueryCache: vi.fn(),
    getQueryData: vi.fn(),
    getQueryState: vi.fn(),
    setQueryData: vi.fn(),
});

const useQuery = vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
});

const useIsMutating = vi.fn().mockReturnValue(0);

export { useQueryClient, useQuery, useIsMutating };
