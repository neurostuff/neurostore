import { vi } from 'vitest';

const ensureWritableStudy = vi.fn().mockResolvedValue({
    studyId: 'study-1',
    didClone: false,
    idMap: { oldAnalysisIdsToNewIdsMap: {}, oldImageIdToNewIdMap: {} },
});

const useEnsureWritableStudy = vi.fn().mockReturnValue({
    ensureWritableStudy,
    isLoading: false,
    userOwnsStudy: true,
});

export default useEnsureWritableStudy;
