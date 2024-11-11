import { vi } from 'vitest';

const useQueryClient = vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
});

const useQuery = vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
});

export { useQueryClient, useQuery };
