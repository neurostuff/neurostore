import { vi } from 'vitest';

const useInitExtraction = vi.fn().mockReturnValue({
    doExtraction: vi.fn().mockResolvedValue(true),
    reset: vi.fn(),
    progress: 0,
    progressText: 'creating studyset...',
    isError: false,
});

export default useInitExtraction;
