import type { ImageReturn } from 'neurostore-typescript-sdk';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import type { BrainMapListItem, UncategorizedImageEntry } from './editStudyAnalysisBoard.types';

export function normalizeAnalysisImages(images: IStoreAnalysis['images'] | undefined): ImageReturn[] {
    if (!images || !Array.isArray(images)) return [];
    return (images as Array<ImageReturn | string>).filter((x): x is ImageReturn => typeof x === 'object' && x !== null);
}

/**
 * Images whose `analysis` FK matches a known analysis id are grouped under that analysis.
 * Images missing or pointing outside the study are treated as uncategorized; each carries the
 * holder analysis id (nested `images` array owner) for moves/removals.
 */
export function partitionAnalysisImages(analyses: IStoreAnalysis[]): {
    uncategorized: UncategorizedImageEntry[];
    byAnalysisId: Record<string, ImageReturn[]>;
} {
    const knownIds = new Set((analyses.map((a) => a.id).filter(Boolean) as string[]) ?? []);
    const byAnalysisId: Record<string, ImageReturn[]> = {};
    const uncategorized: UncategorizedImageEntry[] = [];
    const seenAssigned = new Set<string>();

    for (const analysis of analyses) {
        if (!analysis.id) continue;
        for (const img of normalizeAnalysisImages(analysis.images)) {
            if (!img.id) continue;
            const target = img.analysis;
            if (target && knownIds.has(target)) {
                if (seenAssigned.has(img.id)) continue;
                seenAssigned.add(img.id);
                if (!byAnalysisId[target]) byAnalysisId[target] = [];
                byAnalysisId[target].push(img);
            } else {
                uncategorized.push({ image: img, holderAnalysisId: analysis.id });
            }
        }
    }

    return { uncategorized, byAnalysisId };
}

export function imageToBrainMapListItem(img: ImageReturn): BrainMapListItem {
    const raw = (img.value_type || 'OTHER').toString().toUpperCase();
    const mapType = (raw in DefaultMapTypes ? raw : 'OTHER') as keyof typeof DefaultMapTypes;
    return {
        id: img.id || '',
        name: (img.filename || img.url || 'Image').trim() || 'Image',
        mapType,
    };
}

export function findBrainMapImageById(
    mapId: string | null,
    uncategorized: UncategorizedImageEntry[],
    byAnalysisId: Record<string, ImageReturn[]>
): ImageReturn | undefined {
    if (!mapId) return undefined;
    const fromU = uncategorized.find((u) => u.image.id === mapId)?.image;
    if (fromU) return fromU;
    for (const list of Object.values(byAnalysisId)) {
        const hit = list.find((m) => m.id === mapId);
        if (hit) return hit;
    }
    return undefined;
}

export function removeImageFromAnalyses(
    analyses: IStoreAnalysis[],
    imageId: string
): { next: IStoreAnalysis[]; removed?: ImageReturn } {
    let removed: ImageReturn | undefined;
    const next = analyses.map((a) => ({
        ...a,
        images: normalizeAnalysisImages(a.images).filter((i) => {
            if (i.id === imageId) {
                removed = i;
                return false;
            }
            return true;
        }),
    }));
    return { next, removed };
}

export function addImageToAnalysis(
    analyses: IStoreAnalysis[],
    targetAnalysisId: string,
    image: ImageReturn
): IStoreAnalysis[] {
    return analyses.map((a) => {
        if (a.id !== targetAnalysisId) return a;
        const imgs = normalizeAnalysisImages(a.images);
        return {
            ...a,
            images: [...imgs, { ...image, analysis: targetAnalysisId }],
        };
    });
}

/** Removes the image wherever it appears, then attaches it to `targetAnalysisId`. */
export function moveBrainMapImageToAnalysis(
    analyses: IStoreAnalysis[],
    imageId: string,
    targetAnalysisId: string
): IStoreAnalysis[] | null {
    const { next: afterRemove, removed } = removeImageFromAnalyses(analyses, imageId);
    if (!removed) return null;
    return addImageToAnalysis(afterRemove, targetAnalysisId, { ...removed, analysis: targetAnalysisId });
}

/** Clears `analysis` on the image so `partitionAnalysisImages` lists it as uncategorized. */
export function unassignBrainMapImageFromAnalysis(
    analyses: IStoreAnalysis[],
    analysisId: string,
    imageId: string
): IStoreAnalysis[] {
    return analyses.map((a) => {
        if (a.id !== analysisId) return a;
        return {
            ...a,
            images: normalizeAnalysisImages(a.images).map((i) =>
                i.id === imageId ? { ...i, analysis: undefined } : i
            ),
        };
    });
}
