import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { sortAnalysesByOrder, sortImages } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';

export type EnsureWriteableStudySnapshot = {
    studyId: string;
    /** Analysis ids sorted by `order` (then id). */
    analysisIds: string[];
    /** Per-analysis image ids sorted by filename, url, then id. */
    analysisIdToImageIdsMap: Record<string, string[]>;
    /** Study-level uncategorized image ids, sorted like analysis images. */
    uncategorizedImageIds: string[];
};

/** Old id → new id on the writable study (remapped after clone, or identity when already owned). */
export type ClonedStudyIdMap = {
    oldAnalysisIdsToNewIdsMap: Record<string, string>;
    oldImageIdToNewIdMap: Record<string, string>;
};

const requireId = (id: string | null | undefined, label: string): string => {
    if (!id) throw new Error(`${label} is missing an id`);
    return id;
};

export const buildStudySnapshot = (
    studyId: string,
    analyses: AnalysisReturnNested[],
    uncategorizedImages: ImageReturn[]
): EnsureWriteableStudySnapshot => {
    const sortedAnalyses = sortAnalysesByOrder(analyses);
    const analysisIdToImageIdsMap: Record<string, string[]> = {};

    const analysisIds = sortedAnalyses.map((analysis) => {
        const analysisId = requireId(analysis.id, 'analysis');
        const nestedImages = analysis.images ?? [];
        analysisIdToImageIdsMap[analysisId] = sortImages(nestedImages).map((image) =>
            requireId(image.id, 'analysis image')
        );
        return analysisId;
    });

    return {
        studyId,
        analysisIds,
        analysisIdToImageIdsMap,
        uncategorizedImageIds: sortImages(uncategorizedImages).map((image) =>
            requireId(image.id, 'uncategorized image')
        ),
    };
};

// If there is a count mismatch, we dont necessarily want to throw an error as the studyset still replaces
// the study with the new clone. Instead, we can let the update handler decide how it wants to handle the
// case where there is no ID mapping
const mapOldIdToNewId = (oldIds: string[], newIds: string[], label: string): Record<string, string> => {
    if (oldIds.length !== newIds.length) {
        console.error(`${label} count mismatch after clone (old=${oldIds.length}, new=${newIds.length})`);
    }

    return oldIds.reduce(
        (acc, oldId, index) => {
            if (newIds[index] !== undefined) {
                acc[oldId] = newIds[index]!;
            }
            return acc;
        },
        {} as Record<string, string>
    );
};

export const buildClonedStudyIdMap = (
    oldSnapshot: EnsureWriteableStudySnapshot,
    newSnapshot: EnsureWriteableStudySnapshot
): ClonedStudyIdMap => {
    const oldAnalysisIdsToNewIdsMap = mapOldIdToNewId(oldSnapshot.analysisIds, newSnapshot.analysisIds, 'analyses');

    let oldImageIdToNewIdMap: Record<string, string> = {};

    for (const oldAnalysisId of oldSnapshot.analysisIds) {
        const newAnalysisId = oldAnalysisIdsToNewIdsMap[oldAnalysisId];
        const oldImageIds = oldSnapshot.analysisIdToImageIdsMap[oldAnalysisId] ?? [];
        const newImageIds = newSnapshot.analysisIdToImageIdsMap[newAnalysisId] ?? [];

        oldImageIdToNewIdMap = {
            ...oldImageIdToNewIdMap,
            ...mapOldIdToNewId(oldImageIds, newImageIds, `images for analysis ${oldAnalysisId}`),
        };
    }

    oldImageIdToNewIdMap = {
        ...oldImageIdToNewIdMap,
        ...mapOldIdToNewId(
            oldSnapshot.uncategorizedImageIds,
            newSnapshot.uncategorizedImageIds,
            'uncategorized images'
        ),
    };

    return { oldAnalysisIdsToNewIdsMap, oldImageIdToNewIdMap };
};
