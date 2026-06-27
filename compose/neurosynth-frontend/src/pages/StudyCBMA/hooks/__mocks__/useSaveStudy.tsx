import { vi } from 'vitest';

const useSaveStudy = vi.fn().mockReturnValue({
    isLoading: false,
    hasEdits: false,
    handleSave: vi.fn(),
});

export default useSaveStudy;
