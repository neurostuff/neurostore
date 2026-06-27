import { vi } from 'vitest';

const useEditStudyAnalysisBoardState = vi.fn().mockReturnValue({
    table: {
        options: {
            meta: {
                analyses: [],
                selectedImageId: null,
                toggleImageSelection: vi.fn(),
                updateImage: vi.fn(),
            },
        },
    },
    tableMinWidth: 400,
    uncategorized: [],
    noteKeys: [],
    isLoading: false,
});

export default useEditStudyAnalysisBoardState;
