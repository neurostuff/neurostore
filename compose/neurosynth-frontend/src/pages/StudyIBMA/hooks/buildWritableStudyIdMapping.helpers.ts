import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';

export type EnsureWriteableStudySnapshot = {
    studyId: string;
    /** Analysis ids sorted by `order` (then id). */
    analysisIds: string[];
    /** Per-analysis image ids sorted by filename, url, then id. */
    analysisIdToImageIdsMap: Record<string, string[]>;
    /** Study-level uncategorized image ids, sorted like analysis images. */
    uncategorizedImageIds: string[];
};

/** Old id → new id after a study clone. Only needed when `didClone` is true. */
export type ClonedStudyIdMap = {
    oldAnalysisIdsToNewIdsMap: Record<string, string>;
    oldImageIdToNewIdMap: Record<string, string>;
};

const sortAnalysesByOrder = <T extends { order?: number | null; id?: string | null }>(analyses: T[]): T[] => {
    return [...analyses].sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return (left.id ?? '').localeCompare(right.id ?? '');
    });
};

const sortImages = (images: ImageReturn[]): ImageReturn[] => {
    return [...images].sort((left, right) => {
        const filenameCompare = (left.filename ?? '').localeCompare(right.filename ?? '');
        if (filenameCompare !== 0) return filenameCompare;
        const urlCompare = (left.url ?? '').localeCompare(right.url ?? '');
        if (urlCompare !== 0) return urlCompare;
        return (left.id ?? '').localeCompare(right.id ?? '');
    });
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

const mapOldIdToNewId = (oldIds: string[], newIds: string[], label: string): Record<string, string> => {
    if (oldIds.length !== newIds.length) {
        throw new Error(`${label} count mismatch after clone (old=${oldIds.length}, new=${newIds.length})`);
    }

    return oldIds.reduce(
        (acc, oldId, index) => {
            acc[oldId] = newIds[index]!;
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
