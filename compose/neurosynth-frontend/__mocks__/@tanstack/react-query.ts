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

export { useQueryClient, useQuery };
