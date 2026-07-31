import { vi } from 'vitest';

const ensureWritableStudy = vi.fn().mockResolvedValue({
    studyId: 'study-1',
    didClone: false,
    idMap: { oldAnalysisIdsToNewIdsMap: {}, oldImageIdToNewIdMap: {} },
});

const navigateToStudyEdit = vi.fn();

const useEnsureWritableStudy = vi.fn().mockReturnValue({
    ensureWritableStudy,
    navigateToStudyEdit,
    isLoading: false,
    userOwnsStudy: true,
});

export default useEnsureWritableStudy;
