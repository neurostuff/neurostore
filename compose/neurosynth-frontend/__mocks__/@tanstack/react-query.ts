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

/** Pass-through so query factories using `queryOptions(...)` still expose `.queryKey`. */
const queryOptions = <T>(options: T): T => options;

export { useQueryClient, useQuery, useIsMutating, queryOptions };
