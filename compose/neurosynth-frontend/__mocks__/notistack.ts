import { vi } from 'vitest';

const useSnackbar = vi.fn().mockReturnValue({
    enqueueSnackbar: vi.fn(),
});

export { useSnackbar };
